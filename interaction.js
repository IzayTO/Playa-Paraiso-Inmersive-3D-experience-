// This is an interactive viewer; native text selection interrupts its gestures.
// CSS is the first layer. These listeners also clean up an interrupted gesture
// if Safari supplies a selection or a context menu despite the CSS rules.
export function protectViewerGestures(onInterrupt=()=>{}) {
  for(const name of ['selectstart','contextmenu','dragstart'])document.addEventListener(name,event=>{
    event.preventDefault();onInterrupt();
  });
  document.addEventListener('selectionchange',()=>{
    const selection=window.getSelection?.();
    if(selection&&!selection.isCollapsed){selection.removeAllRanges();onInterrupt();}
  });
}
