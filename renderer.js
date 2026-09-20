import * as THREE from 'three';
export function makeRenderer(){try{return new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{throw new Error('Este navegador no pudo iniciar la vista 3D. Abre la página en Safari o Chrome con WebGL disponible.');}}
