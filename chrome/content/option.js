var adpc_option =
{
 _Prefs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getBranch('extensions.adpc.'),
 _hostList: null,
 _prefList: null,
 init: function()
 {
  let pAll = false;
  if (adpc_option._Prefs.prefHasUserValue('blockAll'))
   pAll = adpc_option._Prefs.getBoolPref('blockAll');
  let cAll = document.getElementById('chkBlockAll');
  cAll.checked = pAll;
  let pObject = '';
  if (adpc_option._Prefs.prefHasUserValue('objectTo'))
   pObject = adpc_option._Prefs.getCharPref('objectTo');
  let aObject = [];
  if (pObject.indexOf(' ') === -1)
   aObject.push(pObject);
  else
   aObject = pObject.split(' ');
  let cDM = document.getElementById('chkDirectMarketing');
  cDM.checked = aObject.includes('direct-marketing');
  let cSDH = document.getElementById('chkSingleChoice');
  if (adpc_option._Prefs.prefHasUserValue('singleChoice'))
   cSDH.checked = adpc_option._Prefs.getBoolPref('singleChoice');
  else
   cSDH.checked = false;
  adpc_option.listHost();
 },
 listHost: async function()
 {
  const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
  let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/option.properties');
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
   adpc_option._hostList = null;
   document.getElementById('cmdClearURL').disabled = true;
  }
  else
  {
   for (let i = 0; i < sHosts.length; i++)
   {
    let xHost = document.createElementNS(XUL_NS, 'menuitem');
    if (sHosts[i] === '*')
     xHost.setAttribute('label', locale.GetStringFromName('host.all'));
    else
     xHost.setAttribute('label', sHosts[i]);
    xHost.setAttribute('value', sHosts[i]);
    cHost.appendChild(xHost);
   }
   document.getElementById('cmbHost').selectedIndex = 0;
   if (document.getElementById('cmbHost').hasAttribute('disabled'))
    document.getElementById('cmbHost').removeAttribute('disabled');
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
    ret = prompts.confirmEx(null, locale.GetStringFromName('clear.prompt.title'), locale.formatStringFromName('clear.prompt.multi', [document.getElementById('cmbHost').itemCount], 1), prompts.STD_YES_NO_BUTTONS, null, null, null, null, {value: false});
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
 bulkImport: async function()
 {
  try
  {
   let prompts = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService);
   let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/option.properties');
   let pLocale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/prompt.properties');
   let picker = Components.classes['@mozilla.org/filepicker;1'].createInstance(Components.interfaces.nsIFilePicker);
   let fileLocator = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties);
   picker.init(window, locale.GetStringFromName('import.picker.title'), picker.modeOpen);
   picker.appendFilter(locale.GetStringFromName('file.json'), '*.json');
   picker.appendFilters(picker.filterAll);
   picker.displayDirectory = fileLocator.get('Docs', Components.interfaces.nsILocalFile);
   if (picker.show() === picker.returnCancel)
    return;
   let fileStream = Components.classes['@mozilla.org/network/file-input-stream;1'].createInstance(Components.interfaces.nsIFileInputStream);
   fileStream.init(picker.file, 0x01, 0444, 0);
   let stream = Components.classes['@mozilla.org/intl/converter-input-stream;1'].createInstance(Components.interfaces.nsIConverterInputStream);
   stream.init(fileStream, 'iso-8859-1', 16384, Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
   stream = stream.QueryInterface(Components.interfaces.nsIUnicharLineInputStream);
   let lines = [];
   let line = {value: null};
   while (stream.readLine(line))
    lines.push(line.value);
   if (line.value)
    lines.push(line.value);
   stream.close();
   let d = JSON.parse(lines.join('\n'));
   if (adpc_option._hostList !== null)
   {
    for (let h = 0; h < adpc_option._hostList.length; h++)
    {
     if (d.hasOwnProperty('include') && d.include.length > 0)
     {
      for (let i = d.include.length - 1; i >= 0; i--)
      {
       if (d.include[i].website !== adpc_option._hostList[h].url)
        continue;
       for (let j = d.include[i].consentRequests.length - 1; j >= 0; j--)
       {
        if (d.include[i].consentRequests[j].id !== adpc_option._hostList[h].name)
         continue;
        d.include[i].consentRequests.splice(j, 1);
       }
       if (d.include[i].consentRequests.length > 0)
        continue;
       d.include.splice(i, 1);
      }
     }
     if (d.hasOwnProperty('exclude') && d.exclude.length > 0)
     {
      for (let i = d.exclude.length - 1; i >= 0; i--)
      {
       if (d.exclude[i].website !== adpc_option._hostList[h].url)
        continue;
       for (let j = d.exclude[i].consentRequests.length - 1; j >= 0; j--)
       {
        if (d.exclude[i].consentRequests[j].id !== adpc_option._hostList[h].name)
         continue;
        d.exclude[i].consentRequests.splice(j, 1);
       }
       if (d.exclude[i].consentRequests.length > 0)
        continue;
       d.exclude.splice(i, 1);
      }
     }
    }
   }
   if ((!d.hasOwnProperty('include') || d.include.length === 0) &&
       (!d.hasOwnProperty('exclude') || d.exclude.length === 0))
   {
    alert(locale.GetStringFromName('import.none'));
    return;
   }
   var x = screen.width / 2 - 650 / 2;
   var y = screen.height / 2 - 300 / 2;
   window.openDialog('chrome://adpc/content/import.xul', '', 'chrome,dialog,resizable=no,alwaysRaised,modal,left=' + x + ',top=' + y, d);
   adpc_option.listHost();
  }
  catch (e)
  {
   console.log(e);
   alert(locale.GetStringFromName('import.error'));
  }
 },
 bulkExport: function()
 {
  try
  {
   let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/option.properties');
   if (adpc_option._hostList === null)
   {
    alert(locale.GetStringFromName('export.none'));
    return;
   }
   let lInclude = {};
   let lExclude = {};
   for (let i = 0; i < adpc_option._hostList.length; i++)
   {
    let c = adpc_option._hostList[i];
    if (adpc_api.isStandardID(c.name))
    {
     if (c.value === 1)
     {
      if (lInclude['*'] === undefined)
       lInclude['*'] = [];
      lInclude['*'][c.name] = c.text;
     }
     if (c.value === 0)
     {
      if (lExclude['*'] === undefined)
       lExclude['*'] = [];
      lExclude['*'] = [];
      lExclude['*'][c.name] = c.text;
     }
    }
    else
    {
     if (c.value === 1)
     {
      if (lInclude[c.url] === undefined)
       lInclude[c.url] = [];
      lInclude[c.url][c.name] = c.text;
     }
     if (c.value === 0)
     {
      if (lExclude[c.url] === undefined)
       lExclude[c.url] = [];
      lExclude[c.url][c.name] = c.text;
     }
    }
   }
   let expList = {};
   expList['include'] = [];
   expList['exclude'] = [];
   for (h in lInclude)
   {
    let e = {'website': h, 'consentRequests': []};
    for (id in lInclude[h])
    {
     let r = {'id': id, 'text': lInclude[h][id]};
     e.consentRequests.push(r);
    }
    expList['include'].push(e);
   }
   for (h in lExclude)
   {
    let e = {'website': h, 'consentRequests': []};
    for (id in lExclude[h])
    {
     let r = {'id': id, 'text': lExclude[h][id]};
     e.consentRequests.push(r);
    }
    expList['exclude'].push(e);
   }
   let sExp = JSON.stringify(expList, null, 1);
   let picker = Components.classes['@mozilla.org/filepicker;1'].createInstance(Components.interfaces.nsIFilePicker);
   let fileLocator = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties);
   picker.init(window, locale.GetStringFromName('export.picker.title'), picker.modeSave);
   picker.defaultExtension = '.json';
   picker.appendFilter(locale.GetStringFromName('file.json'), '*.json');
   picker.appendFilters(picker.filterAll);
   picker.displayDirectory = fileLocator.get('Docs', Components.interfaces.nsILocalFile);
   if (picker.show() != picker.returnCancel)
   {
     let fileStream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
     fileStream.init(picker.file, 0x02 | 0x08 | 0x20, 0644, 0);
     let stream = Components.classes['@mozilla.org/intl/converter-output-stream;1'].createInstance(Components.interfaces.nsIConverterOutputStream);
     stream.init(fileStream, 'UTF-8', 16384, Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
     stream.writeString(sExp);
     stream.close();
     alert(locale.GetStringFromName('export.success'));
   }
  }
  catch (e)
  {
   console.log(e);
   alert(locale.GetStringFromName('export.error'));
  }
 },
 save: async function()
 {
  let cAll = document.getElementById('chkBlockAll');
  adpc_option._Prefs.setBoolPref('blockAll', cAll.checked);
  let cDM = document.getElementById('chkDirectMarketing');
  let aObject = [];
  if (cDM.checked)
   aObject.push('direct-marketing');
  adpc_option._Prefs.setCharPref('objectTo', aObject.join(' '));
  let cSDH = document.getElementById('chkSingleChoice');
  adpc_option._Prefs.setBoolPref('singleChoice', cSDH.checked);
  for (idx in adpc_option._prefList)
  {
   let val = adpc_option._prefList[idx];
   await adpc_api.setConsentByIDX(idx, val);
  }
 }
};
