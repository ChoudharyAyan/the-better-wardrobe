// On-device face matching (owner, 14 Oct 2026: "upload the user's selfie so we can identify them in their
// photos and extract those outfits"). The selfie and every face description stay on this device: what goes
// on to the outfit reader is the photo plus a focus point on the matched person (dist/importers.js, focus),
// so other people in a photo are never singled out or sent anywhere as faces. Models load on first use.
import * as faceapi from './vendor/face-api/face-api.esm.js';

const MODELS='vendor/face-api/model';
// Distances between two face descriptions of the same person are usually under 0.45; strangers above 0.6.
export const MATCH=0.5;
const KEY='tbw-selfie-v1';

let ready=null;
function load(){
  ready??=(async()=>{
    await faceapi.tf.setBackend('webgl').catch(()=>faceapi.tf.setBackend('cpu'));
    await faceapi.tf.ready();
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS);
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS);
  })().catch(error=>{ready=null;throw error;});
  return ready;
}

// Phone photos are large; faces are found on a copy no wider or taller than 1024 px.
async function canvasOf(src){
  const img=new Image();img.src=src;await img.decode();
  const scale=Math.min(1,1024/Math.max(img.naturalWidth,img.naturalHeight));
  const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*scale);c.height=Math.round(img.naturalHeight*scale);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return c;
}
const options=()=>new faceapi.TinyFaceDetectorOptions({inputSize:608,scoreThreshold:0.4});
async function faces(src){
  await load();
  const canvas=await canvasOf(src);
  const found=await faceapi.detectAllFaces(canvas,options()).withFaceLandmarks(true).withFaceDescriptors();
  return {canvas,found};
}

// The face in a selfie: the largest one, so a friend at the edge of the frame doesn't count.
export async function describeSelfie(src){
  const {found}=await faces(src);
  if(!found.length)throw new Error('No face found in that photo. Try one where your face is clear and well lit.');
  const me=found.reduce((a,b)=>b.detection.box.area>a.detection.box.area?b:a);
  return Array.from(me.descriptor);
}

// Where the person is in a photo: no faces (a flat-lay, a garment on a bed) means the whole photo is theirs;
// faces but none of them the person means the photo is skipped; a match gives the focus point on their outfit,
// just below the face, as a percentage of the photo, which is what the outfit reader takes.
export async function findMe(src,descriptor,threshold=MATCH){
  const {canvas,found}=await faces(src);
  if(!found.length)return {status:'no-faces'};
  const me=new Float32Array(descriptor);
  let best=null;
  for(const f of found){const d=faceapi.euclideanDistance(me,f.descriptor);if(!best||d<best.distance)best={distance:d,box:f.detection.box};}
  if(best.distance>threshold)return {status:'not-you',faces:found.length,distance:best.distance};
  const {x,y,width,height}=best.box;
  const fx=(x+width/2)/canvas.width*100,fy=Math.min(95,(y+height*2.2)/canvas.height*100);
  return {status:'you',faces:found.length,distance:best.distance,focus:{x:Math.round(fx),y:Math.round(fy)}};
}

// Kept on this device only (never in the synced wardrobe): the face description and a small thumbnail.
export const saved=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}};
export const save=value=>{try{value?localStorage.setItem(KEY,JSON.stringify(value)):localStorage.removeItem(KEY);}catch{}};
export async function thumbnail(src,size=96){
  const canvas=await canvasOf(src),c=document.createElement('canvas'),side=Math.min(canvas.width,canvas.height);
  c.width=c.height=size;c.getContext('2d').drawImage(canvas,(canvas.width-side)/2,(canvas.height-side)/2,side,side,0,0,size,size);
  return c.toDataURL('image/jpeg',0.8);
}

if(typeof window!=='undefined')window.SelfieMatch={describeSelfie,findMe,saved,save,thumbnail,MATCH};
