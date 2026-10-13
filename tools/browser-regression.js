async (page) => {
  await page.goto('http://127.0.0.1:4292/');await page.setViewportSize({width:1440,height:1000});
  const raw=await page.evaluate(async()=>{const m=await import('./src/model.js');const p=m.emptyProject();p.tracks[0].instrument='pluck';p.tracks[0].notes=[{id:'qa-note',pitch:79,start:960,duration:480,velocity:88}];return JSON.stringify(p);});
  await page.evaluate(raw=>localStorage.setItem('score-lab-project-v1',raw),raw);await page.reload();
  await page.waitForFunction(()=>document.querySelectorAll('.note').length===1);
  await page.locator('.note').click({position:{x:10,y:6}});
  await page.locator('.note').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
  const start=await page.locator('#note-start').inputValue();
  if(start!=='1440')throw Error('KEYBOARD_CONTINUITY: two right presses expected 1440, got '+start);
  const box=await page.locator('.note').boundingBox();
  await page.mouse.move(box.x+10,box.y+6);await page.mouse.down();await page.mouse.move(box.x+60,box.y+6,{steps:5});
  await page.keyboard.press('Escape');await page.mouse.up();
  const after=await page.locator('#note-start').inputValue();
  if(after!==start)throw Error('ESC_ROLLBACK: cancelled note drag moved '+start+' to '+after);
  console.log('PASS score repeated keyboard edits and Escape rollback');
}
