import {VIEW_PRESETS,hotelName,presetName} from './view-presets.js?v=1.4';
const $=id=>document.getElementById(id);
export class Arrival {
  constructor(){
    this.current=null;this.hotel=null;
    for(const hotel of ['lindo','maya'])$(`choose${hotelName(hotel)}`).addEventListener('click',()=>this.chooseHotel(hotel));
    $('arrivalBack').addEventListener('click',()=>{this.hotel=null;this.render();});
    $('arrivalEnter').addEventListener('click',()=>{if(!this.choice)return;this.current=this.choice;$('arrivalDialog').close();document.body.classList.remove('is-arriving');this.resolve?.(this.current);this.resolve=null;});
    $('arrivalCancel').addEventListener('click',()=>$('arrivalDialog').close());
    $('arrivalDialog').addEventListener('cancel',e=>{if(!this.current)e.preventDefault();});
    $('arrivalDialog').addEventListener('close',()=>{if(this.resolve&&this.current){this.resolve(this.current);this.resolve=null;}});
  }
  chooseHotel(hotel){this.hotel=hotel;this.choice=null;this.render();}
  render(){
    $('arrivalHotels').hidden=!!this.hotel;$('arrivalAreas').hidden=!this.hotel;$('arrivalBack').hidden=!this.hotel;$('arrivalEnter').hidden=!this.hotel;$('arrivalEnter').disabled=!this.choice;
    $('arrivalTitle').textContent=this.hotel?'¿En qué edificio estás?':'¿En qué hotel estás?';$('arrivalStep').textContent=this.hotel?`02 / TU PUNTO DE PARTIDA · ${hotelName(this.hotel)}`:'01 / BIENVENIDO A PARAÍSO';
    $('arrivalCancel').hidden=!this.current;$('arrivalAreaList').replaceChildren();
    for(const preset of VIEW_PRESETS.filter(p=>p.hotel===this.hotel)){const button=document.createElement('button');button.className='arrival-choice';button.textContent=preset.label;button.setAttribute('aria-pressed',String(this.choice?.id===preset.id));button.addEventListener('click',()=>{this.choice=preset;this.render();$('arrivalEnter').focus();});$('arrivalAreaList').append(button);}
  }
  open(){this.choice=this.current;this.hotel=this.current?.hotel||null;this.render();$('arrivalDialog').showModal();return new Promise(resolve=>this.resolve=resolve);}
  get label(){return this.current?presetName(this.current):'Tu ubicación';}
}
