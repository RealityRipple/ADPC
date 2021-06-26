Components.utils.import('resource://gre/modules/PopupNotifications.jsm');
var adpc_control =
{
 _Prefs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getBranch('extensions.adpc.'),
 init: function()
 {
  let observerService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);
  observerService.addObserver(adpc_control.eventObserver, 'http-on-modify-request', false);
  observerService.addObserver(adpc_control.eventObserver, 'http-on-examine-response', false);
  observerService.addObserver(adpc_control.eventObserver, 'content-document-global-created', false);
  observerService.addObserver(adpc_control.eventObserver, 'document-element-inserted', false);
 },
 dpcDialog: function(wnd, actions)
 {
  let p = new wnd.Promise(
   async function(resolve, reject)
   {
    let ret = {consent: [], withdraw: [], _object: []};
    if (Array.isArray(actions))
    {
     let uri = wnd.document.domain;
     let retVals = [];
     let prev = adpc_api.getHost(uri);
     let jsPrompt = true;
     if (adpc_control._Prefs.prefHasUserValue('jsPrompt'))
      jsPrompt = adpc_control._Prefs.getBoolPref('jsPrompt');
     let remVals = [];
     let resVals = [];
     for (let i = 0; i < actions.length; i++)
     {
      let val = -1;
      if (actions[i].id in prev)
       val = prev[actions[i].id];
      if (!jsPrompt)
      {
       if (val !== -1)
        remVals.push({id: actions[i].id, text: actions[i].text, value: val});
       else if (adpc_control.allAllowed() || adpc_control.allBlocked())
        resVals.push({id: actions[i].id, text: actions[i].text, value: -1});
       else
        retVals.push({id: actions[i].id, text: actions[i].text, value: val});
      }
      else
       retVals.push({id: actions[i].id, text: actions[i].text, value: val});
     }
     if (retVals.length > 0)
      window.openDialog('chrome://adpc/content/prompt.xul', '', 'chrome,dialog,resizable=no,alwaysRaised,modal,left=150,top=150', uri, retVals);
     for (let i = 0; i < retVals.length; i++)
     {
      await adpc_api.setConsent(uri, retVals[i].id, retVals[i].value, retVals[i].text);
      if (retVals[i].value === 1)
       ret.consent.push(retVals[i].id);
      else if (retVals[i].value === 0)
       ret._object.push(retVals[i].id);
      else
       ret.withdraw.push(retVals[i].id);
     }
     for (let i = 0; i < resVals.length; i++)
     {
      await adpc_api.setConsent(uri, resVals[i].id, resVals[i].value, resVals[i].text);
      if (resVals[i].value === 1)
       ret.consent.push(resVals[i].id);
      else if (resVals[i].value === 0)
       ret._object.push(resVals[i].id);
      else
       ret.withdraw.push(resVals[i].id);
     }
     for (let i = 0; i < remVals.length; i++)
     {
      if (remVals[i].value === 1)
       ret.consent.push(remVals[i].id);
      else if (remVals[i].value === 0)
       ret._object.push(remVals[i].id);
      else
       ret.withdraw.push(remVals[i].id);
     }
    }
    resolve(ret);
   }
  );
  return p;
 },
 handleOnModifyRequest: function(hChan)
 {
  if ((hChan.loadFlags & 0x10000) != 0x10000)
   return;
  if ((hChan.loadFlags & 0x80000) != 0x80000)
   return;
  if (!hChan.hasOwnProperty('loadInfo'))
   return;
  if (hChan.loadInfo.isTopLevelLoad !== true)
   return;
  let hList = adpc_api.getHost(hChan.URI.asciiHost);
  if (hList === null)
   return;
  let hdr = adpc_control.makeHeader(hList);
  if (hdr !== false)
   hChan.setRequestHeader('ADPC', hdr, false);
 },
 handleOnExamineResponse: function(hResp)
 {
  if ((hResp.loadFlags & 0x10000) != 0x10000)
   return;
  if ((hResp.loadFlags & 0x80000) != 0x80000)
   return;
  if (!hResp.hasOwnProperty('loadInfo'))
   return;
  if (hResp.loadInfo.isTopLevelLoad !== true)
   return;
  let hLink = null;
  try
  {
   hLink = hResp.getResponseHeader('Link');
  }
  catch (ex)
  {
   hLink = null;
  }
  if (hLink !== null)
  {
   let sURL = adpc_control.parseFromHeader(hLink);
   if (sURL !== false)
   {
    if (sURL.slice(0, 1) === '/')
     sURL = hResp.URI.prePath + sURL;
    adpc_control.grabJSON(hResp.URI.asciiHost, sURL, hResp.loadInfo.loadingContext);
    return;
   }
  }
 },
 handleDocCreated: function(wnd)
 {
  if (!(wnd instanceof Window))
   return;
  if (!(wnd.navigator instanceof Navigator))
   return;
  let nav = Components.utils.waiveXrays(wnd.navigator);
  let dpc = {};
  if (wnd === wnd.top)
   dpc.request = function(consentRequestsList) { return adpc_control.dpcDialog(wnd, consentRequestsList); };
  else
   dpc.request = function(consentRequestsList) { return new wnd.Promise(async function(resolve, reject) { resolve({consent: [], withdraw: [], _object: []}); }); };
  let dpclone = Components.utils.cloneInto(dpc, nav, {cloneFunctions: true});
  nav.dataProtectionControl = dpclone;
  Components.utils.unwaiveXrays(nav);
 },
 handleDocInserted: function(doc)
 {
  if (doc.head === undefined || doc.head === null)
   return;
  let headElements = doc.head.children;
  if (headElements === undefined || headElements === null || headElements.length === 0)
   return;
  if (doc.defaultView === undefined || doc.defaultView === null)
   return;
  let wnd = null;
  for (let t = 0; t < gBrowser.browsers.length; t++)
  {
   let brw = gBrowser.browsers[t];
   if (doc.defaultView.document === brw.contentDocument)
   {
    wnd = brw;
    break;
   }
  }
  if (wnd === null)
   return;
  let ioService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
  let sHost = ioService.newURI(doc.documentURI);
  let sList = [];
  for (let i = 0; i < headElements.length; i++)
  {
   if (headElements[i].tagName !== 'LINK')
    continue;
   if (headElements[i].rel !== 'consent-requests')
    continue;
   sList.push(headElements[i]);
  }
  if (sList.length === 0)
   return;
  for (let i = 0; i < sList.length; i++)
  {
   if (navigator.languages.includes(sList[i].hreflang))
   {
    adpc_control.grabJSON(sHost.asciiHost, sList[i].href, wnd);
    return;
   }
  }
  for (let i = 0; i < sList.length; i++)
  {
   if (sList[i].hreflang === '')
   {
    adpc_control.grabJSON(sHost.asciiHost, sList[i].href, wnd);
    return;
   }
  }
 },
 eventObserver:
 {
  observe: function(subject, topic, data) 
  {
   switch (topic)
   {
    case 'http-on-modify-request':
     let httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
     adpc_control.handleOnModifyRequest(httpChannel);
     break;
    case 'http-on-examine-response':
     adpc_control.handleOnExamineResponse(subject);
     break;
    case 'content-document-global-created':
     adpc_control.handleDocCreated(subject);
     break;
    case 'document-element-inserted':
     adpc_control.handleDocInserted(subject);
   }
  }
 },
 parseFromHeader: function(hLink)
 {
  let hList = hLink.split(',');
  let sList = [];
  for (let i = 0; i < hList.length; i++)
  {
   let hInfo = hList[i].trim().split(';');
   let hURL = hInfo[0].trim();
   if (hURL.slice(0, 1) !== '<' || hURL.slice(-1) !== '>')
    continue;
   hURL = hURL.slice(1, -1);
   let hRel = null;
   for (let j = 1; j < hInfo.length; j++)
   {
    if (hInfo[j].trim().slice(0, 4) === 'rel=')
    {
     hRel = hInfo[j].trim().slice(4);
     if (hRel.slice(0, 1) === '"' && hRel.slice(-1) === '"')
      hRel = hRel.slice(1, -1);
     break;
    }
   }
   if (hRel !== 'consent-requests')
    continue;
   let hLang = null;
   for (let j = 1; j < hInfo.length; j++)
   {
    if (hInfo[j].trim().slice(0, 9) === 'hreflang=')
    {
     hLang = hInfo[j].trim().slice(9);
     if (hLang.slice(0, 1) === '"' && hLang.slice(-1) === '"')
      hLang = hLang.slice(1, -1);
     break;
    }
   }
   let hData = {url: hURL, lang: hLang};
   sList.push(hData);
  }
  if (sList.length === 0)
   return false;
  for (let i = 0; i < sList.length; i++)
  {
   if (sList[i].lang.toLowerCase() === navigator.language.toLowerCase())
    return sList[i].url;
  }
  for (let i = 0; i < sList.length; i++)
  {
   if (sList[i].lang.slice(0, 2).toLowerCase() === navigator.language.slice(0, 2).toLowerCase())
    return sList[i].url;
  }
  for (let i = 0; i < sList.length; i++)
  {
   if (sList[i].lang === null)
    return sList[i].url;
  }
  return false;
 },
 grabJSON: async function(host, url, wnd)
 {
  if (url === 'about:blank')
   return;
  try
  {
   let timeout = 10000;
   let ab = new AbortController;
   let abid = setTimeout(() => ab.abort(), timeout);
   let ret = await fetch(url, {method: 'GET', cache: 'no-cache', redirect: 'manual', signal: ab.signal});
   clearTimeout(abid);
   if (ret.status !== 200)
    return;
   let txt = await ret.json();
   if (!txt.hasOwnProperty('consentRequests'))
    return;
   let list = [];
   for (let i = 0; i < txt.consentRequests.length; i++)
   {
    let c = await adpc_api.getConsent(host, txt.consentRequests[i].id);
    if (c !== -1)
     continue;
    list.push(txt.consentRequests[i]);
   }
   let iWait = 3000;
   if (adpc_control.allAllowed() || adpc_control.allBlocked())
    iWait = 50;
   setTimeout(adpc_control.showDoorhanger, iWait, list, host, wnd);
  }
  catch (ex)
  {
  }
 },
 showDoorhanger: async function(list, host, wnd)
 {
  if (list.length === 0)
   return;
  if (adpc_control.allAllowed())
  {
   for (let i = 0; i < list.length; i++)
   {
    await adpc_api.setConsent(host, list[i].id, -1, list[i].text);
   }
   return;
  }
  if (adpc_control.allBlocked())
  {
   for (let i = 0; i < list.length; i++)
   {
    await adpc_api.setConsent(host, list[i].id, -1, list[i].text);
   }
   return;
  }
  let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/prompt.properties');
  if (list.length === 1)
  {
   let sPermissionSng = locale.formatStringFromName('permission.single', [host, list[0].text], 2);
   let sAllow = locale.GetStringFromName('allow.label');
   let kAllow = locale.GetStringFromName('allow.accesskey');
   let sDeny = locale.GetStringFromName('deny.label');
   let kDeny = locale.GetStringFromName('deny.accesskey');
   PopupNotifications.show(wnd,
    'adpc',
    sPermissionSng,
    null,
    {
     label: sAllow,
     accessKey: kAllow,
     callback: async function()
     {
      await adpc_api.setConsent(host, list[0].id, 1, list[0].text);
     }
    },
    [
     {
      label: sDeny,
      accessKey: kDeny,
      callback: async function()
      {
       await adpc_api.setConsent(host, list[0].id, 0, list[0].text);
      }
     }
    ],
    {
     learnMoreURL: 'https://www.dataprotectioncontrol.org/'
    }
   );
   return;
  }
  let sPermissionPlr = locale.formatStringFromName('permission.plural', [host], 1);
  let sDetails = locale.GetStringFromName('details.label');
  let kDetails = locale.GetStringFromName('details.accesskey');
  let sAllowAll = locale.GetStringFromName('allow.all.label');
  let kAllowAll = locale.GetStringFromName('allow.all.accesskey');
  let sDenyAll = locale.GetStringFromName('deny.all.label');
  let kDenyAll = locale.GetStringFromName('deny.all.accesskey');
  PopupNotifications.show(wnd,
   'adpc',
   sPermissionPlr,
   null,
   {
    label: sDetails,
    accessKey: kDetails,
    callback: async function() { await adpc_control.showDialog(wnd, host, list); }
   },
   [
    {
     label: sAllowAll,
     accessKey: kAllowAll,
     callback: async function()
     {
      for (let i = 0; i < list.length; i++)
      {
       await adpc_api.setConsent(host, list[i].id, 1, list[i].text);
      }
     }
    },
    {
     label: sDenyAll,
     accessKey: kDenyAll,
     callback: async function()
     {
      for (let i = 0; i < list.length; i++)
      {
       await adpc_api.setConsent(host, list[i].id, 0, list[i].text);
      }
     }
    }
   ],
   {
    learnMoreURL: 'https://www.dataprotectioncontrol.org/'
   }
  );
 },
 showDialog: async function(brw, uri, actions)
 {
  let retVals = [];
  for (let i = 0; i < actions.length; i++)
  {
   retVals.push({id: actions[i].id, text: actions[i].text, value: -1});
  }
  window.openDialog('chrome://adpc/content/prompt.xul', '', 'chrome,dialog,resizable=no,alwaysRaised,modal,left=150,top=150', uri, retVals);
  let laters = [];
  for (let i = 0; i < retVals.length; i++)
  {
   if (retVals[i].value === -1)
    laters.push(retVals[i]);
   await adpc_api.setConsent(uri, retVals[i].id, retVals[i].value, retVals[i].text);
  }
  if (laters.length === 0)
   return;
  let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/prompt.properties'); 
  if (laters.length === 1)
  {
   let sPermissionSng = locale.formatStringFromName('permission.single', [uri, laters[0].text], 2);
   let sAllow = locale.GetStringFromName('allow.label');
   let kAllow = locale.GetStringFromName('allow.accesskey');
   let sDeny = locale.GetStringFromName('deny.label');
   let kDeny = locale.GetStringFromName('deny.accesskey');
   PopupNotifications.show(brw,
    'adpc',
    sPermissionSng,
    null,
    {
     label: sAllow,
     accessKey: kAllow,
     callback: async function()
     {
      await adpc_api.setConsent(uri, laters[0].id, 1, laters[i].text);
     }
    },
    [
     {
      label: sDeny,
      accessKey: kDeny,
      callback: async function()
      {
       await adpc_api.setConsent(uri, laters[0].id, 0, laters[i].text);
      }
     }
    ],
    {
     learnMoreURL: 'https://www.dataprotectioncontrol.org/'
    }
   );
   return;
  }
  let sPermissionPlr = locale.formatStringFromName('permission.plural', [uri], 1);
  let sDetails = locale.GetStringFromName('details.label');
  let kDetails = locale.GetStringFromName('details.accesskey');
  let sAllowAll = locale.GetStringFromName('allow.all.label');
  let kAllowAll = locale.GetStringFromName('allow.all.accesskey');
  let sDenyAll = locale.GetStringFromName('deny.all.label');
  let kDenyAll = locale.GetStringFromName('deny.all.accesskey');
  PopupNotifications.show(brw,
   'adpc',
   sPermissionPlr,
   null,
   {
    label: sDetails,
    accessKey: kDetails,
    callback: async function() { await adpc_control.showDialog(brw, uri, laters); }
   },
   [
    {
     label: sAllowAll,
     accessKey: kAllowAll,
     callback: async function()
     {
      for (let i = 0; i < laters.length; i++)
      {
       await adpc_api.setConsent(uri, laters[i].id, 1, laters[i].text);
      }
     }
    },
    {
     label: sDenyAll,
     accessKey: kDenyAll,
     callback: async function()
     {
      for (let i = 0; i < laters.length; i++)
      {
       await adpc_api.setConsent(uri, laters[i].id, 0, laters[i].text);
      }
     }
    }
   ],
   {
    learnMoreURL: 'https://www.dataprotectioncontrol.org/spec/'
   }
  );
 },
 makeHeader: function(hList)
 {
  let sObject = '';
  let sConsent = '';
  for (id in hList)
  {
   if (adpc_control.allAllowed() || hList[id] === 1)
   {
    if (sConsent === '')
     sConsent = id;
    else
     sConsent += ' ' + id;
   }
   else if (adpc_control.allBlocked() || hList[id] === 0)
   {
    if (sObject === '')
     sObject = id;
    else
     sObject += ' ' + id;
   }
  }
  let hdr = 'withdraw=*';
  if (sObject !== '')
   hdr += ', object="' + sObject + '"';
  if (sConsent !== '')
   hdr += ', consent="' + sConsent + '"';
  if (hdr === 'withdraw=*')
   return false;
  return hdr;
 },
 allAllowed: function()
 {
  if (adpc_control._Prefs.prefHasUserValue('forAll'))
   return (adpc_control._Prefs.getIntPref('forAll') === 1);
  return false;
 },
 allBlocked: function()
 {
  if (adpc_control._Prefs.prefHasUserValue('forAll'))
   return (adpc_control._Prefs.getIntPref('forAll') === -1);
  return false;
 }
};

addEventListener('load', adpc_control.init, false);
