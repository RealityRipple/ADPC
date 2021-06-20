var adpc_prompt =
{
 init: function()
 {
  let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/prompt.properties');
  let sURI = window.arguments[0];
  let sTitle = locale.formatStringFromName('permission.title', [sURI], 1);
  document.getElementById('lblTitle').label = sTitle;
  const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  let sAllow = locale.GetStringFromName('allow.label');
  let kAllow = locale.GetStringFromName('allow.accesskey');
  let sDeny = locale.GetStringFromName('deny.label');
  let kDeny = locale.GetStringFromName('deny.accesskey');
  let sLater = locale.GetStringFromName('later.label');
  let kLater = locale.GetStringFromName('later.accesskey');
  let retVals  = window.arguments[1];
  let lReq = document.getElementById('lstRequest');
  let hasStd = false;
  for (let i = 0; i < retVals.length; i++)
  {
   let std = adpc_prompt.isStandardID(retVals[i].id);
   if (std)
    hasStd = true;
   let lNew = document.createElementNS(XUL_NS, 'vbox');
   lNew.setAttribute('flex', '1');
   let lLbl = document.createElementNS(XUL_NS, 'description');
   lLbl.setAttribute('flex', '1');
   let sTxt = retVals[i].text;
   if (std)
    sTxt += '*'
   lLbl.textContent = sTxt;
   lNew.appendChild(lLbl);
   let lAct = document.createElementNS(XUL_NS, 'hbox');
   lAct.setAttribute('flex', '1');
   let lSpc = document.createElementNS(XUL_NS, 'spacer');
   lSpc.setAttribute('flex', '1');
   lAct.appendChild(lSpc);
   let lGrp = document.createElementNS(XUL_NS, 'radiogroup');
   lGrp.setAttribute('orient', 'horizontal');
   lGrp.setAttribute('id', 'grp' + retVals[i].id);
   let lAllow = document.createElementNS(XUL_NS, 'radio');
   lAllow.setAttribute('label', sAllow);
   lAllow.setAttribute('accesskey', kAllow);
   lAllow.setAttribute('value', 'allow');
   if (retVals[i].value === 1)
    lAllow.setAttribute('selected', 'true');
   lGrp.appendChild(lAllow);
   let lDeny = document.createElementNS(XUL_NS, 'radio');
   lDeny.setAttribute('label', sDeny);
   lDeny.setAttribute('accesskey', kDeny);
   lDeny.setAttribute('value', 'deny');
   if (retVals[i].value === 0)
    lDeny.setAttribute('selected', 'true');
   lGrp.appendChild(lDeny);
   let lLater = document.createElementNS(XUL_NS, 'radio');
   lLater.setAttribute('label', sLater);
   lLater.setAttribute('accesskey', kLater);
   lLater.setAttribute('value', 'later');
   if (retVals[i].value === null || retVals[i].value === -1)
    lLater.setAttribute('selected', 'true');
   lGrp.appendChild(lLater);
   lAct.appendChild(lGrp);
   lNew.appendChild(lAct);
   if (i < retVals.length - 1)
   {
    let lLine = document.createElementNS('http://www.w3.org/1999/xhtml', 'hr');
    lLine.setAttribute('flex', '1');
    lNew.appendChild(lLine);
   }
   lReq.appendChild(lNew);
  }
  let lblStd = document.getElementById('lblStandard');
  if (!hasStd)
   lblStd.style.display = 'none';
 },
 isStandardID: function(id)
 {
  if (id.slice(0, 7) === 'http://')
   return true;
  if (id.slice(0, 8) === 'https://')
   return true;
  return false;
 },
 save: function()
 {
  let retVals  = window.arguments[1];
  for (let i = 0; i < retVals.length; i++)
  {
   let lGrp = document.getElementById('grp' + retVals[i].id);
   if (lGrp.value === 'allow')
    retVals[i].value = 1;
   else if (lGrp.value === 'deny')
    retVals[i].value = 0;
   else
    retVals[i].value = null;
  }
 }
};
