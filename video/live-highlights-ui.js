/* VIDEO-05: optional safe DOM UI; no automatic network requests. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports) module.exports=api;
 if(root) root.BangerHighlightsUI=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 function render(container,items,doc){
   if(!container||!doc||typeof doc.createElement!=='function') return 0;
   container.replaceChildren();
   let count=0;
   for(const item of Array.isArray(items)?items:[]){
     if(!item||item.status!=='link-available'||!item.officialUrl) continue;
     // Revalidate even if upstream adapter has already validated.
     const check=typeof globalThis!=='undefined'&&globalThis.BangerLiveHighlights?.safeUrl;
     const safe=check?check(item.officialUrl):null;
     if(!safe) continue;
     const link=doc.createElement('a');
     link.href=safe;
     link.target='_blank';
     link.rel='noopener noreferrer';
     link.textContent='▶ Přehrát gól na NHL.com';
     link.className='banger-highlight-link';
     link.setAttribute('aria-label','Přehrát oficiální video gólu '+String(item.eventId??''));
     container.appendChild(link);
     count++;
   }
   return count;
 }
 return Object.freeze({render});
});
