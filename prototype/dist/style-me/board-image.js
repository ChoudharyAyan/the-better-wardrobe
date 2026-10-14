/** A local collage export, separate from Gemini's on-self preview. */
export async function renderBoardImage({items,layout,imageFor,labelFor,width=900,height=1200,background='#f3eae0'}) {
  const started=performance.now(),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');context.fillStyle=background;context.fillRect(0,0,width,height);
  const entries=await Promise.all(items.map(async(item,n)=>({item,n,image:await imageFor(item)})));
  entries.sort((a,b)=>(layout[a.item.id]?.depth??a.n)-(layout[b.item.id]?.depth??b.n));
  for(const {item,n,image} of entries){
    const p={x:item.slot==='shoes'?.64:item.slot==='accessory'?.78:item.slot==='outerwear'?.68:.4,y:item.slot==='top'?.25:item.slot==='bottom'?.57:item.slot==='shoes'?.79:item.slot==='accessory'?.25:.4,scale:1,rotation:0,...layout[item.id]};
    context.save();context.translate(p.x*width,p.y*height);context.rotate(p.rotation*Math.PI/180);context.scale(p.scale,p.scale);
    const boxWidth=width*.28,boxHeight=height*.18,scale=Math.min(boxWidth/image.width,boxHeight/image.height);
    context.drawImage(image,-image.width*scale/2,-image.height*scale/2-18,image.width*scale,image.height*scale);
    context.textAlign='center';context.fillStyle='#2b1620';context.font='600 14px Montserrat';context.fillText(item.name,0,boxHeight/2+3,boxWidth);
    context.font='400 11px Montserrat';context.fillText(labelFor(item),0,boxHeight/2+20,boxWidth);context.restore();
  }
  context.fillStyle='#2b1620';context.font='600 15px Montserrat';context.fillText('Style Me · outfit board · illustrative composition, not an on-self preview',20,height-24,width-40);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('The board image could not be created. Your design is saved.');
  return {blob,elapsedMs:performance.now()-started};
}
