import {PlacesView,destinationProjection} from './places-view.js?v=1.4';
import {Minimap} from './minimap.js?v=1.4';
import {normalizePlace,PLACE_TYPES,serializeProject} from './data.js?v=1.4';
import {distance} from './math.js?v=1.4';

const $=id=>document.getElementById(id),number=n=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(n);
const directionLabel=angle=>Math.abs(angle)<Math.PI/6?'De frente':Math.abs(angle)>Math.PI*5/6?'Detrás':angle>0?'Derecha':'Izquierda';
export class ExplorerUI {
  constructor(api){
    this.api=api;this.viewer=api.viewer;this.walk=api.walk;this.role='editor';this.selectedPlace=null;this.destination=null;this.branchIds='';
    this.pins=new PlacesView(this.viewer,p=>this.openPlace(p));this.pins.suspended=()=>api.busy()||$('placeEditor').open;
    this.minimap=new Minimap(this.viewer,$('minimapCanvas'));
    for(const [value,label]of Object.entries(PLACE_TYPES))$('editPlaceCategory').append(new Option(label,value));
    $('modeToggle').addEventListener('click',()=>{if(!api.busy())this.setRole(this.role==='editor'?'guest':'editor');});
    $('closePlaceCard').addEventListener('click',()=>this.closePlace());
    $('destinationBeacon').addEventListener('click',()=>this.destination&&this.openPlace(this.destination));
    $('goToPlace').addEventListener('click',()=>{if(this.selectedPlace)api.goTo(this.selectedPlace);});
    $('editPlace').addEventListener('click',()=>this.editPlace(this.selectedPlace));
    $('addPlace').addEventListener('click',()=>this.editPlace());
    $('cancelPlaceEdit').addEventListener('click',()=>$('placeEditor').close());
    $('placeEditor').addEventListener('close',()=>{this.walk.suspended=api.busy();if(this.walk.active)this.walk.focusScene();});
    $('placeEditorForm').addEventListener('submit',e=>{e.preventDefault();this.savePlace();});
    $('removePlace').addEventListener('click',()=>{if(this.role!=='editor'||!this.editing)return;const name=this.editing.name;this.project.places=this.project.places.filter(p=>p.id!==this.editing.id);this.changed();$('placeEditor').close();api.toast(`Se quitó ${name}. Guarda la maqueta para conservar el cambio.`);});
    $('pickPlacePosition').addEventListener('click',()=>{
      if(this.role!=='editor')return;if(this.walk.active){api.toast('Sal del recorrido para colocar el lugar sobre el plano.');return;}
      $('placeEditor').close();$('workspace').classList.add('is-picking-place');this.viewer.controls.enableRotate=false;this.viewer.controls.enablePan=false;
      this.pins.onPlacePosition=p=>{for(const [i,id]of ['editPlaceX','editPlaceY','editPlaceZ'].entries())$(id).value=Number(p[i].toFixed(4));this.endPicking();$('placeEditor').showModal();this.walk.suspended=true;};
      api.toast('Toca el plano donde irá el lugar. Arrastra con dos dedos para acercar; Esc cancela.');
    });
    window.addEventListener('keydown',e=>{if(e.code==='Escape'&&this.pins.onPlacePosition){this.endPicking();$('placeEditor').showModal();}});
    $('exportProject').addEventListener('click',()=>this.exportProject());
    $('freeRoamButton').addEventListener('click',()=>api.startFree());$('walkFreeRoam').addEventListener('click',()=>api.startFree());
    $('walkSpeed').addEventListener('input',()=>{this.walk.setSpeed($('walkSpeed').value);this.syncSettings();});
    $('showMinimap').addEventListener('change',()=>this.update());
    $('mapOpacity').addEventListener('input',()=>{this.minimap.opacity=Number($('mapOpacity').value)/100;$('mapOpacityValue').textContent=`${Math.round(this.minimap.opacity*100)}%`;this.update();});
    $('minimapMode').addEventListener('click',()=>{this.minimap.headingUp=!this.minimap.headingUp;$('minimapMode').firstChild.textContent=this.minimap.headingUp?'Gira conmigo ':'Norte fijo ';$('minimapMode').setAttribute('aria-label',this.minimap.headingUp?'Fijar el norte arriba':'Girar el minimapa con la mirada');this.update();});
    this.setRole(new URLSearchParams(location.search).get('modo')==='huesped'?'guest':'editor');
  }
  setRole(role){
    this.role=role;this.walk.setRole(role);document.body.dataset.mode=role;$('modeToggle').textContent=role==='guest'?'Vista: Huésped':'Vista: Editor';$('modeToggle').setAttribute('aria-label',role==='guest'?'Cambiar a modo editor':'Cambiar a modo huésped');
    this.endPicking();if($('placeEditor').open)$('placeEditor').close();$('walkSettings').hidden=true;$('walkSettingsButton').setAttribute('aria-expanded','false');
    this.syncSettings();this.refreshPlaces();this.update();
  }
  syncSettings(){const w=this.walk;$('walkSpeed').value=w.speed;$('speedValue').textContent=`${number(w.speed)}×`;$('walkFov').value=w.fov;$('fovValue').textContent=`${Math.round(w.fov)}°`;$('eyeHeight').value=w.eye;$('eyeValue').textContent=`${number(w.eye)} m`;}
  endPicking(){this.pins.onPlacePosition=null;$('workspace').classList.remove('is-picking-place');this.viewer.controls.enableRotate=true;this.viewer.controls.enablePan=true;}
  setProject(project){this.project=project;this.destination=null;this.closePlace();this.endPicking();$('editStatus').hidden=true;this.pins.setPlaces(project.places);this.minimap.setProject(project);this.refreshPlaces();$('freeRoamButton').disabled=!project.network.edges.length;$('walkFreeRoam').disabled=!project.network.edges.length;$('exportProject').disabled=!project.objects.length;$('addPlace').disabled=!project.objects.length;this.update();}
  refreshPlaces(){
    if(!this.project)return;const list=$('placeList');list.replaceChildren();const places=this.project.places.filter(p=>(this.role==='editor'||p.visible)&&(!this.placeFilter||this.placeFilter(p)));$('placeCount').textContent=places.length;
    for(const place of places){const button=document.createElement('button'),dot=document.createElement('span'),name=document.createElement('span');button.type='button';dot.className='place-dot';dot.style.background=place.color;name.textContent=place.name;button.append(dot,name);if(!place.visible){const hidden=document.createElement('small');hidden.textContent='Oculto';button.append(hidden);}button.addEventListener('click',()=>this.api.quickVisit?this.api.quickVisit(place):this.openPlace(place));list.append(button);}
    if(!places.length){const note=document.createElement('p');note.className='micro-copy';note.textContent='Los marcadores de tu archivo aparecerán aquí.';list.append(note);}
  }
  openPlace(place){
    if(this.api.busy())return;this.walk.resetInput();this.selectedPlace=place;$('placeCard').hidden=false;$('placeCard').style.setProperty('--place-color',place.color||'#007f88');$('placeName').textContent=place.name;$('placeCategory').textContent=PLACE_TYPES[place.category]||place.category||'LUGAR';
    for(const [id,value]of [['placeHours',place.hours],['placeDescription',place.description]]){$(id).textContent=value||'';$(id).hidden=!value;}
    $('goToPlace').disabled=!this.api.destinations().some(p=>p.id===place.id);$('enterPlace').disabled=!this.project.network.edges.length;this.updatePlaceDistance();
  }
  closePlace(){this.selectedPlace=null;$('placeCard').hidden=true;}
  updatePlaceDistance(){if(!this.selectedPlace)return;const w=this.walk,from=w.active?w.currentPoint:this.api.origin()?.position;
    $('placeDistance').textContent=from?`${number(distance(from,this.selectedPlace.position))} m en línea recta${w.active?'':' desde el origen'}`:'Elige un origen para calcular el recorrido.';
  }
  setDestination(place){this.destination=place||null;$('destinationBeacon').hidden=!place;this.update();}
  editPlace(place){
    if(this.role!=='editor'||!this.project.objects.length)return;this.walk.resetInput();this.walk.suspended=true;this.editing=place||null;const p=place||normalizePlace({name:'',position:this.walk.active?this.walk.currentPoint:[this.viewer.center.x,0,this.viewer.center.z]});
    $('placeEditorTitle').textContent=place?'Información del lugar':'Un nuevo lugar';$('editPlaceName').value=place?p.name:'';
    if(![...$('editPlaceCategory').options].some(o=>o.value===p.category))$('editPlaceCategory').append(new Option(p.category,p.category));
    $('editPlaceCategory').value=p.category;$('editPlaceColor').value=p.color;$('editPlaceHours').value=p.hours;$('editPlaceDescription').value=p.description;
    ['editPlaceX','editPlaceY','editPlaceZ'].forEach((id,i)=>$(id).value=p.position[i]);$('editPlaceVisible').checked=p.visible;
    $('editPlaceAccess').replaceChildren(new Option('Acceso más cercano',''));
    const authored=this.project.network.sourceNetwork||this.project.network,connected=new Set(authored.edges.flatMap(e=>[e.a,e.b]));for(const n of authored.nodes){if(connected.has(n.id)&&(n.sourceSection||'root')===(p.sourceSection||'root'))$('editPlaceAccess').append(new Option(`${n.name} · X ${number(n.position[0])}, Z ${number(n.position[2])}`,n.id));}
    $('editPlaceAccess').value=p.routeNodeId||'';$('removePlace').hidden=!place;$('pickPlacePosition').disabled=this.walk.active;$('placeEditor').showModal();
  }
  savePlace(){
    if(this.role!=='editor')return;try{
      const id=this.editing?.id||`place-${globalThis.crypto?.randomUUID?.()||Date.now()}`;
      const place=normalizePlace({...this.editing,id,name:$('editPlaceName').value,category:$('editPlaceCategory').value,color:$('editPlaceColor').value,hours:$('editPlaceHours').value,description:$('editPlaceDescription').value,position:['editPlaceX','editPlaceY','editPlaceZ'].map(id=>Number($(id).value)),visible:$('editPlaceVisible').checked,routeNodeId:$('editPlaceAccess').value,locked:this.editing?.locked});
      const i=this.project.places.findIndex(p=>p.id===id);if(i<0)this.project.places.push(place);else this.project.places[i]=place;this.changed();$('placeEditor').close();this.openPlace(place);this.api.toast('Lugar actualizado. Guarda la maqueta para conservarlo.');
    }catch(error){this.api.toast(error.message);}
  }
  changed(){this.api.onPlacesChanged();this.pins.setPlaces(this.project.places);this.minimap.setProject(this.project);this.refreshPlaces();$('editStatus').hidden=false;this.closePlace();this.destination=null;this.update();}
  exportProject(){
    if(this.role!=='editor'||!this.project.objects.length)return;const blob=new Blob([JSON.stringify(serializeProject(this.project),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='paraiso-maqueta.json';a.rel='noopener';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);$('editStatus').hidden=true;this.api.toast('Maqueta guardada con tus lugares. Puedes volver a cargar este JSON.');
  }
  walkStarted(){this.closePlace();$('walkPosition').closest('.walk-progress').hidden=!!this.walk.free;this.syncSettings();this.branchIds='';this.update();}
  walkStopped(){$('minimapPanel').hidden=true;$('junctionPanel').hidden=true;this.branchIds='';this.closePlace();}
  onWalkState(state){
    const choices=state.choices||[],ids=choices.map(c=>c.id).join('|');$('junctionPanel').hidden=!choices.length;
    if(ids!==this.branchIds){this.branchIds=ids;$('junctionChoices').replaceChildren();for(const choice of choices){const button=document.createElement('button');button.dataset.edgeId=choice.id;button.append(document.createElement('strong'),document.createElement('small'));button.addEventListener('click',()=>this.walk.chooseBranch(choice.id));$('junctionChoices').append(button);}}
    choices.forEach((choice,i)=>{const b=$('junctionChoices').children[i];b.firstChild.textContent=directionLabel(choice.cue.angle);b.lastChild.textContent=choice.name;b.setAttribute('aria-label',`${directionLabel(choice.cue.angle)}: ${choice.name}`);});
  }
  update(){
    this.pins.update();this.updatePlaceDistance();const w=this.walk;const show=w.active&&this.role==='editor'&&$('showMinimap').checked;$('minimapPanel').hidden=!show;
    if(show){const p=w.currentPoint;this.minimap.draw(p,w.yaw,w.free?null:this.api.route(),this.destination);$('mapCoordinates').textContent=`X ${number(p[0])} · Z ${number(p[2])}`;}
    const dest=this.destination;$('destinationBeacon').hidden=!dest;if(!dest)return;
    const pos=[...dest.position];pos[1]+=this.viewer.baseEyeHeight*2.5;const p=destinationProjection(this.viewer.camera,pos,this.viewer.container.clientWidth,this.viewer.container.clientHeight);
    $('destinationBeacon').style.left=`${p.x}px`;$('destinationBeacon').style.top=`${p.y}px`;$('destinationBeacon').classList.toggle('is-edge',p.edge);$('beaconName').textContent=dest.name;$('beaconArrow').textContent=p.edge?'↑':'◇';$('beaconArrow').style.transform=`rotate(${p.edge?p.angle:0}rad)`;
    const from=w.active?w.currentPoint:this.api.origin()?.position||this.viewer.camera.position.toArray();$('beaconDistance').textContent=`${number(distance(from,dest.position))} m · línea recta`;
  }
}
