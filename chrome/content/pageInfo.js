var adpc_pageInfo =
{
 _Prefs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getBranch('extensions.adpc.'),
 _host: null,
 init: function()
 {
  window.setTimeout(adpc_pageInfo.postInit, 500);
 },
 postInit: async function()
 {
  let uri = document.getElementById('main-window').getAttribute('relatedUrl');
  let ioService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
  let sHost = ioService.newURI(uri);
  adpc_pageInfo._host = sHost.asciiHost;
  let prefs = await adpc_api.getHost(adpc_pageInfo._host);
  if (prefs === null)
   return;
  for (pref in prefs)
  {
   let lbl = await adpc_api.getLabel(adpc_pageInfo._host, pref);
   adpc_pageInfo.makePerm(pref, lbl, prefs[pref]);
  }
 },
 makePerm: function(id, text, val)
 {
  let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/prompt.properties');
  let sAllow = locale.GetStringFromName('allow.label');
  let sDeny = locale.GetStringFromName('deny.label');
  const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
  let cmdList = document.getElementById('pageInfoCommandSet');
  let cmdChk = document.createElementNS(XUL_NS, 'command');
  cmdChk.setAttribute('id', 'cmd_ADPC_' + id + 'Def');
  cmdChk.setAttribute('oncommand', 'adpc_pageInfo.onCheckboxClick(\'' + id + '\');');
  cmdList.appendChild(cmdChk);
  
  let cmdDef = document.createElementNS(XUL_NS, 'command');
  cmdDef.setAttribute('id', 'cmd_ADPC_' + id + 'Toggle');
  cmdDef.setAttribute('oncommand', 'adpc_pageInfo.onRadioClick(\'' + id + '\');');
  cmdList.appendChild(cmdDef);
  
  let permList = document.getElementById('permList');
  let row = document.createElementNS(XUL_NS, 'vbox');
  row.setAttribute('id', 'permADPC_' + id);
  row.setAttribute('class', 'permission');
  let lbl = document.createElementNS(XUL_NS, 'label');
  lbl.setAttribute('id', 'permADPC_' + id + 'Label');
  lbl.setAttribute('class', 'permissionLabel');
  lbl.setAttribute('value', 'ADPC: ' + text);
  lbl.setAttribute('control', 'ADPC_' + id + 'RadioGroup');
  row.appendChild(lbl);
  let box = document.createElementNS(XUL_NS, 'hbox');
  box.setAttribute('id', 'permADPC_' + id + 'Box');
  box.setAttribute('role', 'group');
  box.setAttribute('aria-labelledby', 'permADPC_' + id + 'Label');
  let chk = document.createElementNS(XUL_NS, 'checkbox');
  chk.setAttribute('id', 'ADPC_' + id + 'Def');
  chk.setAttribute('command', 'cmd_ADPC_' + id + 'Def');
  chk.setAttribute('label', document.getElementById('cookieDef').label);
  chk.setAttribute('oncommand', 'adpc_pageInfo.onCheckboxClick(\'' + id + '\');');
  if (val === -1)
   chk.setAttribute('checked', 'true');
  else
   chk.setAttribute('checked', 'false');
  box.appendChild(chk);
  let spc = document.createElementNS(XUL_NS, 'spacer');
  spc.setAttribute('flex', '1');
  box.appendChild(spc);
  let rgr = document.createElementNS(XUL_NS, 'radiogroup');
  rgr.setAttribute('id', 'ADPC_' + id + 'RadioGroup');
  rgr.setAttribute('orient', 'horizontal');

  let r1 = document.createElementNS(XUL_NS, 'radio');
  r1.setAttribute('id', 'ADPC_' + id + '#1');
  r1.setAttribute('command', 'cmd_ADPC_' + id + 'Toggle');
  r1.setAttribute('label', sAllow);
  r1.setAttribute('oncommand', 'adpc_pageInfo.onRadioClick(\'' + id + '\');');
  if (val === 1)
   r1.setAttribute('selected', 'true');
  else if (adpc_pageInfo._Prefs.prefHasUserValue('forAll') && adpc_pageInfo._Prefs.getIntPref('forAll') === 1)
   r1.setAttribute('selected', 'true');
  else
   r1.setAttribute('selected', 'false');
  rgr.appendChild(r1);
  let r2 = document.createElementNS(XUL_NS, 'radio');
  r2.setAttribute('id', 'ADPC_' + id + '#2');
  r2.setAttribute('command', 'cmd_ADPC_' + id + 'Toggle');
  r2.setAttribute('label', sDeny);
  r2.setAttribute('oncommand', 'adpc_pageInfo.onRadioClick(\'' + id + '\');');
  if (val === 0)
   r2.setAttribute('selected', 'true');
  else if (adpc_pageInfo._Prefs.prefHasUserValue('forAll') && adpc_pageInfo._Prefs.getIntPref('forAll') === -1)
   r2.setAttribute('selected', 'true');
  else
   r2.setAttribute('selected', 'false');
  rgr.appendChild(r2);
  box.appendChild(rgr);
  row.appendChild(box);
  permList.appendChild(row);
  adpc_pageInfo.onCheckboxClick(id);
 },
 onCheckboxClick: async function(aPartId)
 {
  let command  = document.getElementById('cmd_ADPC_' + aPartId + 'Toggle');
  let checkbox = document.getElementById('ADPC_' + aPartId + 'Def');
  if (checkbox.checked)
  {
   command.setAttribute('disabled', 'true');
   await adpc_api.setConsent(adpc_pageInfo._host, aPartId, -1, null);
   if (adpc_pageInfo._Prefs.prefHasUserValue('forAll'))
   {
    let iAll = adpc_pageInfo._Prefs.getIntPref('forAll');
    switch (iAll)
    {
     case -1:
      adpc_pageInfo.setRadioState(aPartId, 2);
      return;
     case 1:
      adpc_pageInfo.setRadioState(aPartId, 1);
      return;
    }
   }
   adpc_pageInfo.setRadioState(aPartId, 2);
  }
  else
  {
   await adpc_pageInfo.onRadioClick(aPartId);
   command.removeAttribute('disabled');
  }
 },
 onRadioClick: async function(aPartId)
 {
  let radioGroup = document.getElementById('ADPC_' + aPartId + 'RadioGroup');
  let id = radioGroup.selectedItem.id;
  let permission = id.split('#')[1];
  switch (permission)
  {
   case '1':
    await adpc_api.setConsent(adpc_pageInfo._host, aPartId, 1, null);
    break;
   case '2':
    await adpc_api.setConsent(adpc_pageInfo._host, aPartId, 0, null);
    break;
  }
 },
 setRadioState: function(aPartId, aValue)
 {
  let radio = document.getElementById('ADPC_' + aPartId + '#' + aValue);
  radio.radioGroup.selectedItem = radio;
 }
};
