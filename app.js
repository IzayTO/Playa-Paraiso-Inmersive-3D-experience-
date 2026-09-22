import {Viewer,knownProps} from './viewer.js?v=1.4';
import {parseProject,readProjectFile,emptyProject} from './data.js?v=1.4';
import {getDestinations,findRoute} from './routing.js?v=1.4';
import {ShadeIndex} from './shade.js?v=1.4';
import {RouteVisual} from './route-visual.js?v=1.4';
import {WalkController} from './walk.js?v=1.4';
import {installIcons} from './icons.js?v=1.4';
import {protectViewerGestures} from './interaction.js?v=1.4';
import {ExplorerUI} from './explorer-ui.js?v=1.4';
import {routeFromLocation,nearestNetworkPoint} from './network-walk.js?v=1.4';
import {prepareConnectedNetwork} from './network-topology.js?v=1.4';
import {Arrival} from './arrival.js?v=1.4';
import {JourneyUI} from './journey-ui.js?v=1.4';

const $=id=>document.getElementById(id);
installIcons();
let viewer,walk,routeVisual,shade,explorer,journey,arrival,project,userProject,demoProject,isDemo=false,selectedRoute=null,destinations=[],specialOrigin=null,operation=0,busy=false,toastTimer;
const currentOrigin=()=>specialOrigin?.id===$('fromSelect').value?specialOrigin:destinations.find(d=>d.id===$('fromSelect').value);
const interactionBusy=()=>busy||!!document.querySelector('dialog[open]');
function setOrigin(origin,clear=true){specialOrigin=destinations.some(d=>d.id===origin.id)?null:origin;fillDestinations();$('fromSelect').value=origin.id;if(clear)clearRoute();}
const formatNumber=n=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(n);
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6000);}
function loading(show,title='Un momento en Paraíso',detail='Cargando la maqueta…',cancellable=false){busy=show;if(walk){walk.suspended=show||$('helpDialog').open;if(show)walk.resetInput();}$('loading').hidden=!show;$('loadingTitle').textContent=title;$('loadingDetail').textContent=detail;$('loadingProgress').value=0;$('cancelBake').hidden=!cancellable;$('importButton').disabled=show;}
function collapsePanel(collapsed){$('routePanel').classList.toggle('is-collapsed',collapsed);$('panelToggle').setAttribute('aria-expanded',String(!collapsed));}
function clearRoute(){selectedRoute=null;routeVisual?.clear();explorer?.setDestination(null);$('routeResult').hidden=true;$('fitRouteButton').disabled=true;$('mobileWalkButton').hidden=true;}
function hideLookHint(){$('lookHint').classList.remove('is-visible');$('lookHint').setAttribute('aria-hidden','true');}
function closeWalk(){walk?.stop();hideLookHint();$('workspace').classList.remove('is-walking');$('walkHUD').hidden=true;$('walkSettings').hidden=true;$('walkSettingsButton').setAttribute('aria-expanded','false');explorer?.walkStopped();viewer.dirty=true;}
function fillDestinations(){
  const oldFrom=$('fromSelect').value,oldTo=$('toSelect').value;destinations=getDestinations(project);
  for(const select of [$('fromSelect'),$('toSelect')]){select.replaceChildren();for(const dest of destinations)select.append(new Option(dest.name,dest.id));}
  if(specialOrigin)$('fromSelect').prepend(new Option(specialOrigin.name,specialOrigin.id));
  if([...$('fromSelect').options].some(o=>o.value===oldFrom))$('fromSelect').value=oldFrom;
  if(destinations.some(d=>d.id===oldTo))$('toSelect').value=oldTo;else if(destinations.length>1)$('toSelect').value=destinations[1].id;
  const ready=destinations.length>0&&(destinations.length>=2||!!specialOrigin);
  $('routeForm').hidden=!ready;$('emptyRoutes').hidden=ready;$('showRoute').disabled=!ready;
  $('modelInfo').textContent=`${project.objects.length} objetos · ${project.network.routes.length ? project.network.routes.length+' rutas' : project.network.edges.length ? 'Caminos conectados':'Sin rutas'}`;
  const hasModel=project.objects.length>0;
  $('emptyRouteMessage').textContent=hasModel?(project.network.edges.length?'Explora los caminos de tu maqueta.':'Esta maqueta aún no tiene rutas.'):'Carga tu maqueta para comenzar.';
  $('emptyRouteHint').textContent=hasModel?(project.network.edges.length?'Activa el modo libre o agrega más lugares para planear un recorrido.':'Guárdalas en el diseñador y vuelve a cargar el archivo.'):'Usa Cargar maqueta en modo editor o explora el ejemplo de abajo.';
  if(!hasModel)$('modelInfo').textContent='Sin maqueta cargada';
  $('sunEnabled').disabled=!hasModel;
}
async function useProject(next,demo=false){
  const ticket=++operation;
  loading(true,'Preparando tu maqueta','Conservando la geometría y sus transparencias…');
  await new Promise(r=>requestAnimationFrame(r));
  next.network=await prepareConnectedNetwork(next.network,p=>{$('loadingProgress').value=p;$('loadingDetail').textContent='Conectando los cruces de tus caminos…';});
  // Build first, so a malformed import never destroys the current model.
  const model=viewer.buildModel(next);if(ticket!==operation)return;
  if(walk.active)closeWalk();clearRoute();shade.invalidate();viewer.setModel(model);project=next;isDemo=demo;specialOrigin=null;
  if(!demo)userProject=next;
  $('sunEnabled').checked=false;$('sunControls').hidden=true;$('skyEnabled').checked=false;viewer.lighting.setSky(false);$('workspace').classList.remove('is-sky');
  const hasModel=next.objects.length>0;
  $('sceneLabel').textContent=demo?'MAQUETA DE EJEMPLO':hasModel?'TU MAQUETA':'UN ESPACIO PARA EXPLORAR';
  $('modelTitle').textContent=demo?'Jardines del Mar':hasModel?next.name.split(' · ').at(-1):'Tu próxima perspectiva';
  $('modelSubtitle').textContent=demo?'Descubre sus caminos y recórrelos a tu ritmo.':hasModel?'Tu maqueta, desde otra perspectiva.':'Carga tu maqueta y descubre cada camino.';
  $('demoButton').querySelector('span').textContent=demo?(userProject?.objects.length?'Volver a mi maqueta':'Cerrar maqueta de ejemplo'):'Probar una maqueta con rutas';
  fillDestinations();explorer?.setProject(project);journey?.setProject(project);updateLightUI();viewer.renderer.compile(viewer.scene,viewer.camera);viewer.render();$('loadingProgress').value=1;
  loading(false);if(window.innerWidth<=760)collapsePanel(true);
}
function currentMode(){return document.querySelector('input[name=routeMode]:checked').value;}
function applyRoute(route,from,to){
  selectedRoute={...route,from,to};if(route.length>0)routeVisual.show(route);else routeVisual.clear();
  explorer?.setDestination(to);
  $('routeName').textContent=route.names.join(' · ')||'Camino entre tus destinos';
  $('routeDistance').textContent=`${formatNumber(route.length)} m`;
  $('routeTime').textContent=`≈ ${Math.max(1,Math.round(route.length/1.35/60))} min a pie`;
  $('routeShade').textContent=shade.cache?`${Math.round(route.shade*100)}% con sombra`:'';
  const access=to.accessDistance>Math.max(.2,viewer.baseEyeHeight*.5)?` La ruta termina en su acceso; el lugar está a ${formatNumber(to.accessDistance)} m en línea recta.`:'';
  $('routeNote').textContent=(route.mode==='shade'?'Sombra estimada para la posición actual del sol. Puedes recalcular si cambias la luz.':route.mode==='fast'?'El camino conectado de menor distancia.':'Da prioridad a los caminos con nombre de tu maqueta.')+access;
  $('routeResult').hidden=false;$('fitRouteButton').disabled=!route.length;$('mobileWalkButton').hidden=false;
}
async function goToPlace(place){
  if(busy)return;const to=destinations.find(d=>d.id===place.id);if(!to){toast('Este lugar no tiene un acceso conectado. Puedes asignarlo en modo editor.');return;}
  explorer.setDestination(to);explorer.closePlace();
  if(!walk.active){$('toSelect').value=to.id;await showRoute();return;}
  try{
    const mode=currentMode(),location=walk.location(project.network),ticket=operation;
    if(mode==='shade'&&!shade.cache){loading(true,'Encontrando el mejor camino','Comprobando la luz y las zonas cubiertas…');await shade.prepare(project.network,viewer.lighting.path,p=>$('loadingProgress').value=p);loading(false);}
    if(ticket!==operation)return;
    const route=routeFromLocation(project.network,location,to.nodeId,mode,shade.scores(viewer.lighting.position)),from={id:'current',name:'Tu posición',position:[...walk.currentPoint]};
    applyRoute(route,from,to);startWalk();toast(`Continúa desde aquí hacia ${to.name}.`);
  }catch(error){loading(false);if(error.name!=='AbortError')toast(error.message);}
}
function startFree(locationOverride=null){
  if(busy||!project.network.edges.length)return;
  try{
    const origin=currentOrigin(),start=locationOverride|| (walk.active?walk.location(project.network):origin?.location||nearestNetworkPoint(project.network,origin?.accessPosition||origin?.position||project.network.nodes[0].position));
    walk.startFree(project.network,start);clearRoute();$('workspace').classList.add('is-walking');$('walkHUD').hidden=false;$('viewMenu').hidden=true;$('walkSettings').hidden=true;$('walkSettingsButton').setAttribute('aria-expanded','false');collapsePanel(true);
    $('walkDestination').textContent='EXPLORACIÓN LIBRE';explorer.walkStarted();walk.update(0);showLookHint();
    toast('Explora los caminos conectados. En los cruces podrás elegir hacia dónde seguir.');
  }catch(error){toast(error.message);}
}
async function showRoute(){
  if(busy)return;
  const from=currentOrigin(),to=destinations.find(d=>d.id===$('toSelect').value);if(!from||!to){toast('Elige un punto de partida y un destino.');return;}
  const ticket=operation,mode=currentMode();
  try{
    if(!from.location&&from.nodeId===to.nodeId)throw new Error('Esos dos lugares comparten el mismo acceso. Elige otro destino.');
    if(mode==='shade'&&!shade.cache){loading(true,'Encontrando el mejor camino','Comprobando la luz y las zonas cubiertas…');await shade.prepare(project.network,viewer.lighting.path,p=>$('loadingProgress').value=p);loading(false);}
    if(ticket!==operation)return;
    const route=from.location?routeFromLocation(project.network,from.location,to.nodeId,mode,shade.scores(viewer.lighting.position)):findRoute(project.network,from.nodeId,to.nodeId,mode,shade.scores(viewer.lighting.position));
    applyRoute(route,from,to);
    // Showing a route never changes the user's framing; centering is explicit.
    if(window.innerWidth<=760)collapsePanel(true);
    toast(`${from.name} → ${to.name}. Ruta preparada.`);
  }catch(error){loading(false);if(error.name!=='AbortError')toast(error.message);}
}
function startWalk(){
  if(!selectedRoute||busy)return;
  $('workspace').classList.add('is-walking');$('walkHUD').hidden=false;$('viewMenu').hidden=true;collapsePanel(true);
  $('walkFrom').textContent=selectedRoute.from.name;$('walkTo').textContent=selectedRoute.to.name;
  $('walkDestination').textContent=`HACIA ${selectedRoute.to.name}`;
  walk.start(selectedRoute,selectedRoute.from,selectedRoute.to);
  $('eyeHeight').value=walk.eye;$('eyeValue').textContent=`${formatNumber(walk.eye)} m`;
  updateFovUI();explorer.walkStarted();showLookHint();
}
function showLookHint(){
  hideLookHint();
  $('lookHint').querySelector('small').textContent=matchMedia('(pointer:coarse)').matches?'El joystick te lleva hacia delante y atrás.':'W y S te llevan hacia delante y atrás.';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(walk.active&&!walk.hasLooked){$('lookHint').classList.add('is-visible');$('lookHint').setAttribute('aria-hidden','false');}}));
}
function updateFovUI(){$('walkFov').value=walk.fov;$('fovValue').textContent=`${Math.round(walk.fov)}°`;$('walkFov').setAttribute('aria-valuetext',`${Math.round(walk.fov)} grados`);}
function changeFov(value){walk.setFov(value);updateFovUI();}
function updateLightUI(){
  const light=viewer.lighting,p=light.position;
  const name=p<.16?'Amanecer':p>.84?'Atardecer':p<.4?'Sol de mañana':p>.6?'Sol de tarde':'Mediodía';
  $('lightSummary').textContent=light.enabled?`${name} · ${light.duration} min`:light.skyEnabled?'Cielo azul':'Maqueta blanca';
  $('sunPhase').textContent=name+(light.enabled&&light.phase>1?' · de regreso':'');
  if(document.activeElement!==$('sunPosition'))$('sunPosition').value=Math.round(p*1000);
  $('sunPlay').textContent=light.playing?'Pausar':'Reproducir';$('sunPlay').setAttribute('aria-label',light.playing?'Pausar movimiento del sol':'Reproducir movimiento del sol');
}
async function enableSun(path=$('sunPath').value){
  if(!project.objects.length)return;
  const ticket=operation;
  try{
    loading(true,'Preparando la luz','Preparando la iluminación y los caminos…',true);
    viewer.lighting.setEnabled(false);await viewer.lighting.prepare(path,p=>{$('loadingProgress').value=p*.84;$('loadingDetail').textContent=`Preparando sombras · ${Math.round(p*100)}%`;});
    await shade.prepare(project.network,path,p=>{$('loadingProgress').value=.84+p*.16;$('loadingDetail').textContent='Comprobando los caminos con sombra…';});
    if(ticket!==operation)return;
    viewer.lighting.setEnabled(true);$('sunEnabled').checked=true;$('sunControls').hidden=false;viewer.dirty=true;updateLightUI();loading(false);
  }catch(error){viewer.lighting.setEnabled(false);$('sunEnabled').checked=false;$('sunControls').hidden=true;loading(false);if(error.name!=='AbortError')toast('No se pudo preparar la luz. La vista blanca sigue disponible.');updateLightUI();console.warn(error);}
}
function wireUI(){
  $('importButton').addEventListener('click',()=>{if(explorer.role==='editor')$('fileInput').click();});
  $('fileInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const next=await readProjectFile(file,knownProps);await useProject(next);toast('Tu maqueta está lista.');}catch(error){loading(false);toast(error.message);}finally{e.target.value='';}});
  $('demoButton').addEventListener('click',async()=>{if(busy)return;try{if(isDemo)await useProject(userProject,false);else{if(!demoProject){const response=await fetch('./demo.json');if(!response.ok)throw new Error('No se pudo abrir el ejemplo.');demoProject=parseProject(await response.json(),knownProps);}await useProject(demoProject,true);}}catch(error){loading(false);toast(error.message);}});
  $('routeForm').addEventListener('submit',e=>{e.preventDefault();showRoute();});
  $('swapPlaces').addEventListener('click',()=>{const old=$('fromSelect').value;if(!destinations.some(d=>d.id===old)){toast('El origen señalado es un acceso. Elige un lugar en Desde para intercambiarlo.');return;}$('fromSelect').value=$('toSelect').value;$('toSelect').value=old;clearRoute();});
  for(const id of ['fromSelect','toSelect'])$(id).addEventListener('change',clearRoute);
  document.querySelectorAll('input[name=routeMode]').forEach(el=>el.addEventListener('change',clearRoute));
  $('clearRoute').addEventListener('click',clearRoute);$('walkButton').addEventListener('click',startWalk);$('mobileWalkButton').addEventListener('click',startWalk);$('exitWalk').addEventListener('click',closeWalk);
  $('centerButton').addEventListener('click',()=>{journey.remember();if(!journey.applyHome(true,false))viewer.frame('aerial');});
  $('viewButton').addEventListener('click',()=>$('viewMenu').hidden=!$('viewMenu').hidden);
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{viewer.frame(button.dataset.view==='route'?'aerial':button.dataset.view,true,button.dataset.view==='route'?routeVisual.bounds:undefined);$('viewMenu').hidden=true;}));
  $('zoomIn').addEventListener('click',()=>viewer.zoom(.8));$('zoomOut').addEventListener('click',()=>viewer.zoom(1.25));
  $('panelToggle').addEventListener('click',()=>collapsePanel(!$('routePanel').classList.contains('is-collapsed')));
  $('lightToggle').addEventListener('click',()=>{const open=$('lightBody').hidden;$('lightBody').hidden=!open;$('lightPanel').classList.toggle('is-open',open);$('lightToggle').setAttribute('aria-expanded',String(open));});
  $('sunEnabled').addEventListener('change',()=>{if($('sunEnabled').checked)enableSun();else{viewer.lighting.setEnabled(false);$('sunControls').hidden=true;viewer.dirty=true;updateLightUI();}});
  $('skyEnabled').addEventListener('change',()=>{viewer.lighting.setSky($('skyEnabled').checked);$('workspace').classList.toggle('is-sky',$('skyEnabled').checked);viewer.dirty=true;updateLightUI();});
  $('sunPath').addEventListener('change',()=>{if(viewer.lighting.enabled)enableSun();else{viewer.lighting.path=$('sunPath').value;shade.invalidate();}});
  $('sunDuration').addEventListener('change',()=>{viewer.lighting.duration=Number($('sunDuration').value);updateLightUI();});
  $('sunPlay').addEventListener('click',()=>{viewer.lighting.playing=!viewer.lighting.playing;updateLightUI();});
  $('sunPosition').addEventListener('input',()=>{viewer.lighting.seek(Number($('sunPosition').value)/1000);viewer.dirty=true;updateLightUI();});
  $('cancelBake').addEventListener('click',()=>{viewer.lighting.abort?.abort();shade.invalidate();});
  $('walkPosition').addEventListener('input',()=>walk.seek(Number($('walkPosition').value)/1000));
  // Return pointer users to the scene once they release a slider. Keyboard
  // adjustment keeps its focus until WASD explicitly resumes the walk.
  let rangePointer=null;
  for(const range of document.querySelectorAll('input[type=range]'))range.addEventListener('pointerdown',e=>{if(walk.active){walk.resetInput();rangePointer=e.pointerId;}});
  const releaseRange=e=>{if(e.pointerId===rangePointer){rangePointer=null;requestAnimationFrame(()=>{if(walk.active&&!busy&&!$('helpDialog').open)viewer.container.focus({preventScroll:true});});}};
  window.addEventListener('pointerup',releaseRange);window.addEventListener('pointercancel',releaseRange);
  document.addEventListener('focusin',()=>walk.resetInput());
  $('walkSettingsButton').addEventListener('click',()=>{walk.resetInput();const show=$('walkSettings').hidden;$('walkSettings').hidden=!show;$('walkSettingsButton').setAttribute('aria-expanded',String(show));});
  $('eyeHeight').addEventListener('input',()=>{if(explorer.role!=='editor')return;walk.eye=Number($('eyeHeight').value);viewer.camera.near=Math.max(.001,walk.eye*.05);viewer.camera.updateProjectionMatrix();$('eyeValue').textContent=`${formatNumber(walk.eye)} m`;});
  $('walkFov').addEventListener('input',()=>changeFov($('walkFov').value));
  $('resetFov').addEventListener('click',()=>changeFov(100));
  $('helpButton').addEventListener('click',()=>{walk.resetInput();walk.suspended=true;$('helpDialog').showModal();});$('closeHelp').addEventListener('click',()=>$('helpDialog').close());
  $('helpDialog').addEventListener('close',()=>{walk.suspended=busy;if(walk.active)viewer.container.focus({preventScroll:true});});
  $('helpDialog').addEventListener('click',e=>{if(e.target===$('helpDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!document.querySelector('dialog[open]')){if(walk.active)closeWalk();explorer.closePlace();$('originMenu').hidden=true;$('layerPanel').hidden=true;$('viewMenu').hidden=true;$('walkSettings').hidden=true;$('walkSettingsButton').setAttribute('aria-expanded','false');}});
  viewer.onContextLost=()=>{viewer.lighting.abort?.abort();loading(true,'La vista se ha pausado','Esperando a que el dispositivo recupere la imagen…');};
  viewer.onContextRestored=()=>{viewer.lighting.invalidate();$('sunEnabled').checked=false;$('sunControls').hidden=true;loading(false);viewer.dirty=true;updateLightUI();toast('La vista se recuperó. Puedes volver a activar el sol.');};
}
function registerTools(){
  const context=document.modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();
  const register=tool=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'get_resort_destinations',description:'Lee los lugares disponibles en la maqueta actual.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({name:project.name,destinations:destinations.map(({id,name})=>({id,name})),hasRoute:!!selectedRoute})});
  register({name:'show_resort_route',description:'Selecciona y muestra una ruta en la maqueta actual.',inputSchema:{type:'object',properties:{from:{type:'string'},to:{type:'string'},mode:{type:'string',enum:['standard','fast','shade']}},required:['from','to','mode'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async input=>{if(busy)throw new Error('Espera a que termine la preparación.');if(!input||!destinations.some(d=>d.id===input.from)||!destinations.some(d=>d.id===input.to)||!['standard','fast','shade'].includes(input.mode))throw new Error('Destino o tipo de ruta inválido.');$('fromSelect').value=input.from;$('toSelect').value=input.to;document.querySelectorAll('input[name=routeMode]').forEach(r=>r.checked=r.value===input.mode);clearRoute();await showRoute();if(!selectedRoute)throw new Error('No hay una ruta disponible.');return {distance:selectedRoute.length,names:selectedRoute.names,mode:selectedRoute.mode};}});
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
async function init(){
  arrival=new Arrival();await arrival.open();
  viewer=new Viewer($('scene'));shade=new ShadeIndex(viewer);routeVisual=new RouteVisual(viewer);
  walk=new WalkController(viewer,state=>{
    if(state.free){$('directionText').textContent=state.choices.length?'Elige por dónde seguir':state.atEnd?'Final de este camino':state.cue.text;$('walkRemaining').textContent=state.atEnd?'Retrocede para volver al cruce.':`${formatNumber(state.traveled)} m explorados`;}
    else{
    routeVisual.setProgress(state.fraction);if(document.activeElement!==$('walkPosition'))$('walkPosition').value=Math.round(state.fraction*1000);
    $('directionText').textContent=state.atEnd?'Llegaste a tu destino':state.cue.text;
    $('directionArrow').style.transform=`rotate(${state.cue.angle*180/Math.PI}deg)`;
    $('walkRemaining').textContent=state.atEnd?'Puedes retroceder para volver.':`${formatNumber(state.remaining)} m para llegar`;
    }
    $('directionArrow').style.transform=`rotate(${state.cue.angle*180/Math.PI}deg)`;explorer?.onWalkState(state);
  });walk.bindJoystick($('joystick'),$('joystickThumb'));walk.onLook=hideLookHint;
  explorer=new ExplorerUI({viewer,walk,busy:interactionBusy,destinations:()=>destinations,route:()=>selectedRoute,origin:currentOrigin,goTo:goToPlace,startFree,toast,quickVisit:p=>journey?.quickVisit(p),onPlacesChanged:()=>{if(walk.active)closeWalk();clearRoute();fillDestinations();}});
  journey=new JourneyUI({viewer,walk,explorer,routeVisual,busy:interactionBusy,destinations:()=>destinations,route:()=>selectedRoute,isDemo:()=>isDemo,setOrigin,closeWalk,startFree,toast,
    restoreRoute:(route,progress)=>{if(route){setOrigin(route.from,false);$('toSelect').value=route.to.id;applyRoute(route,route.from,route.to);routeVisual.setProgress(progress);}else clearRoute();},
    restoreWalk:state=>{if(state.free)startFree(state.free.location);else startWalk();walk.restoreState(state);explorer.walkStarted();walk.update(0);}},arrival);
  updateFovUI();protectViewerGestures(()=>walk.resetInput());wireUI();
  await useProject(emptyProject());
  const sharedMap=new URLSearchParams(location.search).get('map');if(['demo','published'].includes(sharedMap)){try{const response=await fetch(sharedMap==='demo'?'./demo.json':'./mapa.json');if(!response.ok)throw new Error('Para abrir la vista compartida, carga la misma maqueta con Cargar maqueta.');const next=parseProject(await response.json(),knownProps);if(sharedMap==='demo')demoProject=next;await useProject(next,sharedMap==='demo');}catch(error){loading(false);toast(error.message);}}
  registerTools();
  let previous=performance.now(),lastRender=0,lastUI=0;const minFrame=matchMedia('(pointer:coarse)').matches?1000/30:1000/60;
  function frame(time){requestAnimationFrame(frame);const dt=Math.min((time-previous)/1000,.05);previous=time;if(document.hidden||busy)return;viewer.update();viewer.lighting.update(dt);walk.update(dt);const animated=routeVisual.update()||(viewer.lighting.enabled&&viewer.lighting.playing)||!!viewer.transition;
    if((viewer.dirty||animated)&&time-lastRender>=minFrame){explorer.pins.update();viewer.render();lastRender=time;}
    if(time-lastUI>100){updateLightUI();explorer.update();const heading=viewer.camera.rotation.y;$('compassNeedle').style.transform=`rotate(${heading*180/Math.PI}deg)`;lastUI=time;}
  }requestAnimationFrame(frame);
}
init().catch(error=>{console.error(error);loading(false);const layer=document.createElement('div');layer.className='fatal';const title=document.createElement('h2');title.textContent='No pudimos abrir la maqueta';const detail=document.createElement('p');detail.textContent=error.message||'Comprueba que el navegador admita WebGL y vuelve a cargar.';const button=document.createElement('button');button.className='button';button.textContent='Volver a intentar';button.addEventListener('click',()=>location.reload());layer.append(title,detail,button);$('workspace').append(layer);});
