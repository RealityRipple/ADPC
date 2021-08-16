var adpc_import =
{
 _vals: [],
 init: function()
 {
  let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/prompt.properties');
  let optLocale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/option.properties');
  let bulkVals = window.arguments[0];
  const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
  let sAllow = locale.GetStringFromName('allow.label');
  let kAllow = locale.GetStringFromName('allow.accesskey');
  let sDeny = locale.GetStringFromName('deny.label');
  let kDeny = locale.GetStringFromName('deny.accesskey');
  let lReq = document.getElementById('lstRequest');
  let hasStd = false;
  let retVals = [];
  if (bulkVals.hasOwnProperty('include') && bulkVals.include.length > 0)
  {
   for (let i = 0; i < bulkVals.include.length; i++)
   {
    for (let j = 0; j < bulkVals.include[i].consentRequests.length; j++)
    {
     if (bulkVals.include[i].website === '*')
      hasStd = true;
     let e = {
      'website': bulkVals.include[i].website,
      'id': bulkVals.include[i].consentRequests[j].id,
      'text': bulkVals.include[i].consentRequests[j].text,
      'value': 1
     };
     retVals.push(e);
    }
   }
  }
  if (bulkVals.hasOwnProperty('exclude') && bulkVals.exclude.length > 0)
  {
   for (let i = 0; i < bulkVals.exclude.length; i++)
   {
    for (let j = 0; j < bulkVals.exclude[i].consentRequests.length; j++)
    {
     if (bulkVals.exclude[i].website === '*')
      hasStd = true;
     let e = {
      'website': bulkVals.exclude[i].website,
      'id': bulkVals.exclude[i].consentRequests[j].id,
      'text': bulkVals.exclude[i].consentRequests[j].text,
      'value': 0
     };
     retVals.push(e);
    }
   }
  }
  retVals.sort(
   function(a, b)
   {
    let w = a.website.localeCompare(b.website);
    if (w !== 0)
     return w;
    let d = a.id.localeCompare(b.id);
    if (d !== 0)
     return d;
   }
  );
  adpc_import._vals = retVals;
  let lastHost = null;
  for (let i = 0; i < retVals.length; i++)
  {
   let skipHost = false;
   if (lastHost === retVals[i].website)
    skipHost = true;
   lastHost = retVals[i].website;
   let std = adpc_api.isStandardID(retVals[i].id);
   if (retVals[i].website === '*')
    std = true;
   if (std)
    hasStd = true;
   let lNew = document.createElementNS(XUL_NS, 'vbox');
   lNew.setAttribute('flex', '1');
   if (!skipHost)
   {
    let lHost = document.createElementNS(XUL_NS, 'hbox');
    lHost.setAttribute('flex', '1');
    lHost.setAttribute('align', 'center');

    let lSite = document.createElementNS(XUL_NS, 'label');
    lSite.setAttribute('class', 'header');
    if (retVals[i].website === '*')
     lSite.textContent = optLocale.GetStringFromName('host.all');
    else
     lSite.textContent = retVals[i].website;
    lHost.appendChild(lSite);

    let lLnBox = document.createElementNS(XUL_NS, 'vbox');
    lLnBox.setAttribute('flex', '1');
    let lLine = document.createElementNS('http://www.w3.org/1999/xhtml', 'hr');
    lLine.setAttribute('flex', '1');
    lLnBox.appendChild(lLine);
    lHost.appendChild(lLnBox);

    lNew.appendChild(lHost);
   }
   let lChoiceBox = document.createElementNS(XUL_NS, 'hbox');
   lChoiceBox.setAttribute('flex', '1');
   lChoiceBox.setAttribute('align', 'top');
   let lChoiceChk = document.createElementNS(XUL_NS, 'checkbox');
   lChoiceChk.setAttribute('id', 'chk' + retVals[i].website + '_' + retVals[i].id);
   lChoiceBox.appendChild(lChoiceChk);
   let lLbl = document.createElementNS(XUL_NS, 'label');
   lLbl.setAttribute('control', 'chk' + retVals[i].website + '_' + retVals[i].id);
   lLbl.addEventListener('click', adpc_import.toggleChk, false);
   lLbl.setAttribute('flex', '1');
   lLbl.setAttribute('class', 'plain');
   let sTxt = retVals[i].text;
   if (std)
    sTxt += '*'
   lLbl.textContent = sTxt;
   let lAct = document.createElementNS(XUL_NS, 'hbox');
   let lGrp = document.createElementNS(XUL_NS, 'radiogroup');
   lGrp.setAttribute('orient', 'horizontal');
   lGrp.setAttribute('id', 'grp' + retVals[i].website + '_' + retVals[i].id);
   let lAllow = document.createElementNS(XUL_NS, 'radio');
   lAllow.setAttribute('label', sAllow);
   lAllow.setAttribute('accesskey', kAllow);
   lAllow.setAttribute('value', 'allow');
   if (retVals[i].value === 1)
    lAllow.setAttribute('selected', 'true');
   else
    lAllow.setAttribute('disabled', 'true');
   lGrp.appendChild(lAllow);
   let lDeny = document.createElementNS(XUL_NS, 'radio');
   lDeny.setAttribute('label', sDeny);
   lDeny.setAttribute('accesskey', kDeny);
   lDeny.setAttribute('value', 'deny');
   if (retVals[i].value === 0)
   {
    lDeny.setAttribute('selected', 'true');
    lChoiceChk.setAttribute('checked', 'true');
   }
   else
   {
    lDeny.setAttribute('disabled', 'true');
    lChoiceChk.setAttribute('checked', 'false');
   }
   lGrp.appendChild(lDeny);
   lAct.appendChild(lGrp); 
   lChoiceBox.appendChild(lLbl);
   lChoiceBox.appendChild(lAct);
   lNew.appendChild(lChoiceBox);
   lReq.appendChild(lNew);
  }
  let lblStd = document.getElementById('lblStandard');
  if (!hasStd)
   lblStd.style.display = 'none';
 },
 toggleChk: function(ev)
 {
  if (ev.button !== 0)
   return;
  let chk = document.getElementById(ev.target.getAttribute('control'));
  if (chk === undefined)
   return;
  chk.checked = !chk.checked;
 },
 save: async function()
 {
  for (let i = 0; i < adpc_import._vals.length; i++)
  {
   if (document.getElementById('chk' + adpc_import._vals[i].website + '_' + adpc_import._vals[i].id).getAttribute('checked') === 'true')
   {
    await adpc_api.setConsent(adpc_import._vals[i].website, adpc_import._vals[i].id, adpc_import._vals[i].value, adpc_import._vals[i].text);
   }
   //else
   // await adpc_api.setConsent(adpc_import._vals[i].website, adpc_import._vals[i].id, -1, adpc_import._vals[i].text);
  }
  window.close();
 }
};
