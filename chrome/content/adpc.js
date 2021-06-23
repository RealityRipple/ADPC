Components.utils.import('resource://gre/modules/PopupNotifications.jsm');
var adpc_control =
{
 _Prefs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getBranch('extensions.adpc.'),
 _alert: {},
 init: function()
 {
  let observerService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);
  observerService.addObserver(adpc_control.httpRequestObserver, 'http-on-modify-request', false);
  observerService.addObserver(adpc_control.httpResponseObserver, 'http-on-examine-response', false);
  observerService.addObserver(adpc_control.documentCreated, 'document-element-inserted', false);
 },
 /*
 dpcRequest: async function(d)
 {
  let dRet = await adpc_control.dpcDialog(this, d);
  return dRet;
 },
 dpcDialog: async function(brw, actions)
 {
  let p = new Promise(
   function(resolve, reject)
   {
    let ret = {consent: [], withdraw: ['*'], object: []};
    let uri = brw.registeredOpenURI.asciiHost;
    let retVals = [];
    for (let i = 0; i < actions.length; i++)
    {
     retVals.push({id: actions[i].id, text: actions[i].text, value: -1});
    }
    window.openDialog('chrome://adpc/content/prompt.xul', '', 'chrome,dialog,resizable=no,alwaysRaised,modal,left=150,top=150', uri, retVals);
    for (let i = 0; i < retVals.length; i++)
    {
     await adpc_api.setConsent(uri, retVals[i].id, retVals[i].value, retVals[i].text);
     if (retVals[i].value === 1)
      ret.consent.push(retVals[i].id);
     else if (retVals[i].value === 0)
      ret.object.push(retVals[i].id);
    }
    resolve(ret);
   }
  );
  return p;
 },
 */
 httpRequestObserver:
 {
  observe: function(subject, topic, data) 
  {
   if (topic !== 'http-on-modify-request')
    return;
   let httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
   if ((httpChannel.loadFlags & 0x10000) != 0x10000)
    return;
   if ((httpChannel.loadFlags & 0x80000) != 0x80000)
    return;
   if (!httpChannel.hasOwnProperty('loadInfo'))
    return;
   if (httpChannel.loadInfo.isTopLevelLoad !== true)
    return;
   let hList = adpc_api.getHost(httpChannel.URI.asciiHost);
   if (hList === null)
    return;
   let hdr = adpc_control.makeHeader(hList);
   if (hdr !== false)
    httpChannel.setRequestHeader('ADPC', hdr, false);
  }
 },
 httpResponseObserver:
 {
  observe: function(subject, topic, data) 
  {
   if (topic !== 'http-on-examine-response')
    return;
   let hLink = null;
   try
   {
    hLink = subject.getResponseHeader('Link');
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
      sURL = subject.URI.prePath + sURL;
     adpc_control.grabJSON(subject.URI.asciiHost, sURL);
     return;
    }
   }
  }
 },
 documentCreated:
 {
  observe: function(subject, topic, data) 
  {
   if (topic !== 'document-element-inserted')
    return;
   if (subject.head === undefined || subject.head === null)
    return;
   let headElements = subject.head.children;
   if (headElements === undefined || headElements === null || headElements.length === 0)
    return;
   let ioService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
   let sHost = ioService.newURI(subject.documentURI);
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
     adpc_control.grabJSON(sHost.asciiHost, sList[i].href);
     return;
    }
   }
   for (let i = 0; i < sList.length; i++)
   {
    if (sList[i].hreflang === '')
    {
     adpc_control.grabJSON(sHost.asciiHost, sList[i].href);
     return;
    }
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
 grabJSON: async function(host, url)
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
   if (!adpc_control._alert.hasOwnProperty(host))
    adpc_control._alert[host] = {timer: null, list: []};
   if (adpc_control._alert[host].timer !== null)
   {
    clearTimeout(adpc_control._alert[host].timer);
    adpc_control._alert[host].timer = null;
   }
   for (let i = 0; i < txt.consentRequests.length; i++)
   {
    let c = await adpc_api.getConsent(host, txt.consentRequests[i].id);
    if (c !== -1)
     continue;
    adpc_control._alert[host].list.push(txt.consentRequests[i]);
   }
   adpc_control._alert[host].timer = setTimeout(adpc_control.showDoorhanger, 5000);
  }
  catch (ex)
  {
  }
 },
 showDoorhanger: async function()
 {
  for (let t = 0; t < gBrowser.tabs.length; t++)
  {
   let brw = gBrowser.tabs[t].linkedBrowser;
   let tURI = brw.registeredOpenURI.asciiHost;
   if (!adpc_control._alert.hasOwnProperty(tURI))
    continue;
   let aList = adpc_control._alert[tURI].list;
   delete adpc_control._alert[tURI];
   if (aList.length === 0)
    continue;
   if (adpc_control.allAllowed())
   {
    for (let i = 0; i < aList.length; i++)
    {
     await adpc_api.setConsent(tURI, aList[i].id, -1, aList[i].text);
    }
    continue;
   }
   if (adpc_control.allBlocked())
   {
    for (let i = 0; i < aList.length; i++)
    {
     await adpc_api.setConsent(tURI, aList[i].id, -1, aList[i].text);
    }
    continue;
   }
   let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/prompt.properties');
   if (aList.length === 1)
   {
    let sPermissionSng = locale.formatStringFromName('permission.single', [tURI, aList[0].text], 2);
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
       await adpc_api.setConsent(tURI, aList[0].id, 1, aList[0].text);
      }
     },
     [
      {
       label: sDeny,
       accessKey: kDeny,
       callback: async function()
       {
        await adpc_api.setConsent(tURI, aList[0].id, 0, aList[0].text);
       }
      }
     ],
     {
      learnMoreURL: 'https://www.dataprotectioncontrol.org/'
     }
    );
    continue;
   }
   let sPermissionPlr = locale.formatStringFromName('permission.plural', [tURI], 1);
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
     callback: async function() { await adpc_control.showDialog(brw, tURI, aList); }
    },
    [
     {
      label: sAllowAll,
      accessKey: kAllowAll,
      callback: async function()
      {
       for (let i = 0; i < aList.length; i++)
       {
        await adpc_api.setConsent(tURI, aList[i].id, 1, aList[i].text);
       }
      }
     },
     {
      label: sDenyAll,
      accessKey: kDenyAll,
      callback: async function()
      {
       for (let i = 0; i < aList.length; i++)
       {
        await adpc_api.setConsent(tURI, aList[i].id, 0, aList[i].text);
       }
      }
     }
    ],
    {
     learnMoreURL: 'https://www.dataprotectioncontrol.org/'
    }
   );
  }
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
