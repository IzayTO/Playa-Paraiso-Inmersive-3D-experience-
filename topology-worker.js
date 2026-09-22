import {buildConnectedNetwork} from './network-topology.js?v=1.4';
self.onmessage=event=>{try{const network=buildConnectedNetwork(event.data,progress=>self.postMessage({progress}));self.postMessage({network});}catch(error){self.postMessage({error:error.message});}};
