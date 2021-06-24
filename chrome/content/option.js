var adpc_option =
{
 _Prefs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getBranch('extensions.adpc.'),
 _hostList: null,
 _prefList: null,
 init: function()
 {
  let pAll = 0;
  if (adpc_option._Prefs.prefHasUserValue('forAll'))
   pAll = adpc_option._Prefs.getIntPref('forAll');
  let cAll = document.getElementById('cmbAll');
  cAll.value = pAll;
  adpc_option.listHost();
 },
 listHost: async function()
 {
  const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
  let retVals = await adpc_api._read(adpc_api._dbURLList, 'SELECT url, id, text FROM ' + adpc_api._dbURLList, {}, ['url', 'id', 'text']);
  let sHosts = [];
  adpc_option._prefList = {};
  for (let i = 0; i < retVals.length; i++)
  {
   if (!sHosts.includes(retVals[i].url))
    sHosts.push(retVals[i].url);
   let val = await adpc_api.getConsentFromIDX(retVals[i].id);
   if (val === null)
    continue;
   retVals[i].name = val.name;
   retVals[i].value = val.value;
   adpc_option._prefList[retVals[i].id] = val.value;
  }
  let cHost = document.getElementById('cmbHost').childNodes[0];
  while (cHost.firstChild)
  {
   cHost.removeChild(cHost.firstChild);
  }
  if (sHosts.length === 0)
  {
   let xHost = document.createElementNS(XUL_NS, 'menuitem');
   xHost.setAttribute('label', 'No ADPC Websites Visited');
   xHost.setAttribute('value', '');
   cHost.appendChild(xHost);
   document.getElementById('cmbHost').selectedIndex = 0;
   document.getElementById('cmbHost').setAttribute('disabled', 'true');
   document.getElementById('lblStandard').style.display = 'none';
   let lReq = document.getElementById('lstRequest');
   while (lReq.firstChild)
   {
    lReq.removeChild(lReq.firstChild);
   }
   document.getElementById('cmdClearURL').disabled = true;
  }
  else
  {
   for (let i = 0; i < sHosts.length; i++)
   {
    let xHost = document.createElementNS(XUL_NS, 'menuitem');
    xHost.setAttribute('label', sHosts[i]);
    xHost.setAttribute('value', sHosts[i]);
    cHost.appendChild(xHost);
   }
   document.getElementById('cmbHost').selectedIndex = 0;
   adpc_option._hostList = retVals;
   document.getElementById('cmdClearURL').disabled = false;
   await adpc_option.populateHost();
  }
 },
 populateHost: async function()
 {
  if (adpc_option._hostList === null)
  {
   let retVals = await adpc_api._read(adpc_api._dbURLList, 'SELECT url, id, text FROM ' + adpc_api._dbURLList, {}, ['url', 'id', 'text']);
   adpc_option._prefList = {};
   for (let i = 0; i < retVals.length; i++)
   {
    let val = await adpc_api.getConsentFromIDX(retVals[i].id);
    if (val === null)
     continue;
    retVals[i].name = val.name;
    retVals[i].value = val.value;
    adpc_option._prefList[retVals[i].id] = val.value;
   }
   adpc_option._hostList = retVals;
  }
  const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
  let nHost = document.getElementById('cmbHost');
  let lblStd = document.getElementById('lblStandard');
  document.getElementById('cmdClearURL').setAttribute('oncommand', 'adpc_option.clear("' + nHost.value + '");');

  let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/prompt.properties');
  let sAllow = locale.GetStringFromName('allow.label');
  let kAllow = locale.GetStringFromName('allow.accesskey');
  let sDeny = locale.GetStringFromName('deny.label');
  let kDeny = locale.GetStringFromName('deny.accesskey');
  let sLater = locale.GetStringFromName('later.label');
  let kLater = locale.GetStringFromName('later.accesskey');
  let lReq = document.getElementById('lstRequest');
  while (lReq.firstChild)
  {
   lReq.removeChild(lReq.firstChild);
  }
  let retVals = [];
  for (let i = 0; i < adpc_option._hostList.length; i++)
  {
   if (adpc_option._hostList[i].url !== nHost.value)
    continue;
   retVals.push(adpc_option._hostList[i]);
  }
  if (retVals.length === 0)
  {
   lblStd.style.display = 'none';
   return;
  }
  let hasStd = false;
  for (let i = 0; i < retVals.length; i++)
  {
   let std = adpc_api.isStandardID(retVals[i].name);
   if (std)
    hasStd = true;
   let lNew = document.createElementNS(XUL_NS, 'vbox');
   lNew.setAttribute('flex', '1');
   let lLbl = document.createElementNS(XUL_NS, 'description');
   lLbl.setAttribute('flex', '1');
   let iVal = retVals[i].value;
   if (retVals[i].id in adpc_option._prefList)
    iVal = adpc_option._prefList[retVals[i].id];
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
   lGrp.setAttribute('id', 'grp' + retVals[i].name);
   let lAllow = document.createElementNS(XUL_NS, 'radio');
   lAllow.setAttribute('label', sAllow);
   lAllow.setAttribute('accesskey', kAllow);
   lAllow.setAttribute('value', 'allow');
   lAllow.setAttribute('oncommand', 'adpc_option.chooseOpt(\'' + retVals[i].id + '\', 1);')
   if (iVal === 1)
    lAllow.setAttribute('selected', 'true');
   lGrp.appendChild(lAllow);
   let lDeny = document.createElementNS(XUL_NS, 'radio');
   lDeny.setAttribute('label', sDeny);
   lDeny.setAttribute('accesskey', kDeny);
   lDeny.setAttribute('value', 'deny');
   lDeny.setAttribute('oncommand', 'adpc_option.chooseOpt(\'' + retVals[i].id + '\', 0);')
   if (iVal === 0)
    lDeny.setAttribute('selected', 'true');
   lGrp.appendChild(lDeny);
   let lLater = document.createElementNS(XUL_NS, 'radio');
   lLater.setAttribute('label', sLater);
   lLater.setAttribute('accesskey', kLater);
   lLater.setAttribute('value', 'later');
   lLater.setAttribute('oncommand', 'adpc_option.chooseOpt(\'' + retVals[i].id + '\', -1);')
   if (iVal === -1)
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
  if (!hasStd)
   lblStd.style.display = 'none';
  else
   lblStd.style.display = '-moz-box';
 },
 chooseOpt: function(id, val)
 {
  if (adpc_option._prefList === null)
   adpc_option._prefList = {};
  adpc_option._prefList[id] = val;
 },
 clear: async function(url)
 {
  let prompts = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService);
  let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/option.properties');
  if (url === undefined || url === null)
   url = false;
  let hList = await adpc_api._read(adpc_api._dbURLList, 'SELECT url, id, text FROM ' + adpc_api._dbURLList, {}, ['url', 'id', 'text']);
  let iCt = 0;
  if (hList !== false && hList.length > 0)
  {
   let ret = false;
   if (url === false)
    ret = prompts.confirmEx(null, locale.GetStringFromName('clear.prompt.title'), locale.formatStringFromName('clear.prompt.multi', ['' + hList.length], 1), prompts.STD_YES_NO_BUTTONS, null, null, null, null, {value: false});
   else
    ret = prompts.confirmEx(null, locale.GetStringFromName('clear.prompt.title'), locale.formatStringFromName('clear.prompt.url', [url], 1), prompts.STD_YES_NO_BUTTONS, null, null, null, null, {value: false});
   if (ret === 1)
    return;
   for (let i = 0; i < hList.length; i++)
   {
    if (url !== false && hList[i].url !== url)
     continue;
    let idx = hList[i].id;
    let pRows = await adpc_api._read(adpc_api._dbIDList, 'SELECT name FROM ' + adpc_api._dbIDList + ' WHERE idx = :idx', {'idx': idx}, ['name']);
    if (pRows === false)
     continue;
    if (pRows.length !== 1)
     continue;
    await adpc_api.withdrawConsent(hList[i].url, pRows[0].name);
    iCt++;
   }
  }
  if (iCt === 0)
   alert(locale.GetStringFromName('clear.none'));
  else
   alert(locale.formatStringFromName('clear.success', [iCt], 1));
  adpc_option.listHost();
 },
 save: async function()
 {
  let cAll = document.getElementById('cmbAll');
  adpc_option._Prefs.setIntPref('forAll', cAll.value);
  for (idx in adpc_option._prefList)
  {
   let val = adpc_option._prefList[idx];
   await adpc_api.setConsentByIDX(idx, val);
  }
 }
};
