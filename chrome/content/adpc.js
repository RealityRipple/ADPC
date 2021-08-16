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
  Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch).addObserver('extensions.adpc.objectTo', adpc_control.prefObserver, false);
  window.getBrowser().addProgressListener(adpc_control.progressListener);
  adpc_control.makeEye(window);
 },
 prefObserver:
 {
  observe: function(aSubject, aTopic, aData)
  {
   let otList = false;
   if (adpc_control._Prefs.prefHasUserValue('objectTo'))
    otList = adpc_control._Prefs.getCharPref('objectTo').split(' ');
   let mdtr = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
   let brw = mdtr.getEnumerator('navigator:browser');
   while (brw.hasMoreElements())
   {
    let inst = brw.getNext();
    let gw = inst.gBrowser;
    for (let i = 0; i < gw.browsers.length; i++)
    {
     let bri = gw.getBrowserAtIndex(i);
     let wnd = bri.contentWindow;
     if (wnd !== wnd.top)
      continue;
     if (wnd.navigator.wrappedJSObject === undefined)
      continue;
     if (wnd.navigator.wrappedJSObject.dataProtectionControl === undefined)
      continue;
     let decisions = {withdraw: ['*']};
     let prev = adpc_api.getHost(bri.currentURI.asciiHost);
     if (prev !== null)
     {
      for (n in prev)
      {
       if (prev[n] === 1)
       {
        if (!decisions.hasOwnProperty('consent'))
         decisions.consent = [];
        decisions.consent.push(n);
       }
      }
     }
     if (adpc_control._Prefs.prefHasUserValue('objectTo'))
      decisions.object = adpc_control._Prefs.getCharPref('objectTo').split(' ');
     let evt = new wnd.CustomEvent('decisionchange', {detail: decisions});
     wnd.navigator.wrappedJSObject.dataProtectionControl.dispatchEvent(evt);
    }
   }
  }
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
  if (hLink === null)
   return;
  let sURL = adpc_control.parseFromHeader(hLink);
  if (sURL === false)
   return;
  if (gBrowser.browsers === undefined || gBrowser.browsers === null || gBrowser.browsers.length === 0)
   return;
  let wnd = null;
  for (let t = 0; t < gBrowser.browsers.length; t++)
  {
   let brw = gBrowser.browsers[t];
   if (hResp.loadInfo.loadingContext === brw)
   {
    wnd = brw;
    break;
   }
  }
  if (wnd === null)
   return;
  if (sURL.slice(0, 1) === '/')
   sURL = hResp.URI.prePath + sURL;
  adpc_control.grabJSON(hResp.URI.asciiHost, sURL, wnd);
 },
 handleDocCreated: function(wnd)
 {
  if (!(wnd instanceof Window))
   return;
  if (!(wnd.navigator instanceof Navigator))
   return;
  let host = wnd.document.domain;
  let dpc = {};
  if (wnd === wnd.top)
  {
   dpc =
   {
    request: function(consentRequestsList)
    {
     return new wnd.wrappedJSObject.Promise
     (
      Components.utils.exportFunction
      (
       function(resolve, reject)
       {
        adpc_control.jsRequest(wnd, host, consentRequestsList).then
        (
         reqRet =>
         {
          if (adpc_control._Prefs.prefHasUserValue('objectTo'))
           reqRet.object = adpc_control._Prefs.getCharPref('objectTo').split(' ');
          resolve(Components.utils.cloneInto(reqRet, wnd.wrappedJSObject));
         }
        );
       }, wnd.wrappedJSObject
      )
     );
    }
   };
  }
  else
   dpc = { request: function(consentRequestsList) { return new wnd.wrappedJSObject.Promise(Components.utils.exportFunction(function(resolve, reject) { resolve(Components.utils.cloneInto( { }, wnd.wrappedJSObject)); }, wnd.wrappedJSObject)); } };
  dpc.listeners = {};
  dpc.addEventListener = Components.utils.exportFunction(function(type, listener, options)
  {
   let o = {};
   if (options === true || options === false)
    o.capture = options;
   else
    o = options;
   let scr = 'if (globalThis.AdpcEvent === undefined)\n';
   scr+= '{\n';
   scr+= ' class AdpcEvent extends Event\n';
   scr+= ' {\n';
   scr+= '  constructor(type, options)\n';
   scr+= '  {\n';
   scr+= '   super(type);\n';
   scr+= '   this.userDecisions = options;\n';
   scr+= '  }\n';
   scr+= ' }\n';
   scr+= ' globalThis.AdpcEvent = AdpcEvent;\n';
   scr+= '}';
   adpc_control.executePageScript(wnd.document, scr);
   if (!(type in dpc.listeners))
    dpc.listeners[type] = [];
   dpc.listeners[type].push(listener);
  }, wnd.wrappedJSObject);
  dpc.removeEventListener = Components.utils.exportFunction(function(type, listener, options)
  {
   let o = {};
   if (options === true || options === false)
    o.capture = options;
   else
    o = options;
   
   if (!(type in dpc.listeners))
    return;
   let stack = dpc.listeners[type];
   for (let i = 0, l = stack.length; i < l; i++)
   {
    if (stack[i] === listener)
    {
     stack.splice(i, 1);
     return;
    }
   }
  }, wnd.wrappedJSObject);
  dpc.dispatchEvent = Components.utils.exportFunction(function(event)
  {
   if (!(event.type in dpc.listeners))
    return true;
   let stack = dpc.listeners[event.type].slice();
   for (let i = 0, l = stack.length; i < l; i++)
   {
    try
    {
     let nEvt = new wnd.wrappedJSObject.AdpcEvent(event.type, Components.utils.cloneInto(event.detail, wnd.wrappedJSObject));
     stack[i].call(dpc, nEvt);
    }
    catch (ex)
    {
     console.log('Error dispatching AdpcEvent:', ex);
     console.log('If you are overwriting the AdpcEvent class, please keep a constructor with the first two parameters (type, userDecisions), and the \'AdpcEvent.userDecisions\' property as a settable object.');
    }
   }
   return !event.defaultPrevented;
  }, wnd.wrappedJSObject);
  wnd.navigator.wrappedJSObject.dataProtectionControl = Components.utils.cloneInto(dpc, wnd.wrappedJSObject, {cloneFunctions: true});
 },
 executePageScript: function(doc, script)
 {
  let eScr = doc.createElement('script');
  eScr.textContent = script;
  doc.head.appendChild(eScr);
  eScr.remove();
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
  if (gBrowser.browsers === undefined || gBrowser.browsers === null || gBrowser.browsers.length === 0)
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
   let actions = [];
   for (let i = 0; i < txt.consentRequests.length; i++)
   {
    let c = await adpc_api.getConsent(host, txt.consentRequests[i].id);
    if (c !== -1)
     continue;
    actions.push(txt.consentRequests[i]);
   }
   let iWait = 3000;
   if (adpc_control.allBlocked())
    iWait = 50;
   setTimeout(adpc_control.linkRequest, iWait, wnd, host, actions);
  }
  catch (ex)
  {
  }
 },
 linkRequest: async function(wnd, host, actions)
 {
  if (actions.length === 0)
   return;
  adpc_control.showEye(window, host);
  if (adpc_control.allBlocked())
  {
   for (let i = 0; i < actions.length; i++)
   {
    await adpc_api.setConsent(host, actions[i].id, -1, actions[i].text);
   }
   return;
  }
  adpc_control._linkDoorhanger(wnd, host, actions);
 },
 jsRequest: function (wnd, host, actions)
 {
  let p = new Promise(
   async function(resolve, reject)
   {
    let blankRet = {};
    if (!Array.isArray(actions))
    {
     resolve(blankRet);
     return;
    }
    if (actions.length === 0)
    {
     resolve(blankRet);
     return;
    }
    let dhRet = await adpc_control._jsDoorhanger(wnd, host, actions);
    resolve(dhRet);
   }
  );
  return p;
 },
 _linkDoorhanger: function(wnd, host, actions)
 {
  if (actions.length === 0)
   return;
  if (host !== wnd.registeredOpenURI.asciiHost)
   return;
  let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/prompt.properties');
  let singleDoorhanger = false;
  if (adpc_control._Prefs.prefHasUserValue('singleDoorhanger'))
   singleDoorhanger = adpc_control._Prefs.getBoolPref('singleDoorhanger');
  if (singleDoorhanger && actions.length === 1)
  {
   let cleanText = actions[0].text;
   cleanText = cleanText.replaceAll('"', '');
   while (cleanText.includes('\'\''))
   {
    cleanText = cleanText.replaceAll('\'\'', '\'');
   }
   let sPermissionSng = locale.formatStringFromName('permission.single', [adpc_api.baseDomain(host), cleanText], 2);
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
      adpc_control.showEye(window, host);
      await adpc_api.setConsent(host, actions[0].id, 1, actions[0].text);
     }
    },
    [
     {
      label: sDeny,
      accessKey: kDeny,
      callback: async function()
      {
       adpc_control.showEye(window, host);
       await adpc_api.setConsent(host, actions[0].id, 0, actions[0].text);
      }
     }
    ],
    {
     learnMoreURL: 'https://www.dataprotectioncontrol.org/'
    }
   );
   return;
  }
  let sPermissionPlr = locale.formatStringFromName('permission.plural', [adpc_api.baseDomain(host)], 1);
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
    callback: async function() { await adpc_control._linkDialog(wnd, host, actions); }
   },
   [
    {
     label: sAllowAll,
     accessKey: kAllowAll,
     callback: async function()
     {
      adpc_control.showEye(window, host);
      for (let i = 0; i < actions.length; i++)
      {
       await adpc_api.setConsent(host, actions[i].id, 1, actions[i].text);
      }
     }
    },
    {
     label: sDenyAll,
     accessKey: kDenyAll,
     callback: async function()
     {
      adpc_control.showEye(window, host);
      for (let i = 0; i < actions.length; i++)
      {
       await adpc_api.setConsent(host, actions[i].id, 0, actions[i].text);
      }
     }
    }
   ],
   {
    learnMoreURL: 'https://www.dataprotectioncontrol.org/'
   }
  );
 },
 _linkDialog: async function(wnd, host, actions)
 {
  let retVals = [];
  for (let i = 0; i < actions.length; i++)
  {
   retVals.push({id: actions[i].id, text: actions[i].text, value: -1});
  }
  window.openDialog('chrome://adpc/content/prompt.xul', '', 'chrome,dialog,resizable=no,alwaysRaised,modal,left=150,top=150', adpc_api.baseDomain(host), retVals);
  let laters = [];
  adpc_control.showEye(window, host);
  for (let i = 0; i < retVals.length; i++)
  {
   if (retVals[i].value === -1)
    laters.push(retVals[i]);
   await adpc_api.setConsent(host, retVals[i].id, retVals[i].value, retVals[i].text);
  }
  if (laters.length === 0)
   return;
  adpc_control._linkDoorhanger(wnd, host, laters);
 },
 _jsDoorhanger: function(src, host, actions)
 {
  let p = new Promise(
   async function(resolve, reject)
   {
    if (gBrowser.browsers === undefined || gBrowser.browsers === null || gBrowser.browsers.length === 0)
     return;
    let wnd = null;
    for (let t = 0; t < gBrowser.browsers.length; t++)
    {
     let brw = gBrowser.browsers[t];
     if (src === brw.contentWindow)
     {
      wnd = brw;
      break;
     }
    }
    if (wnd === null)
     return;
    if (host !== wnd.registeredOpenURI.asciiHost)
     return;
    let prev = adpc_api.getHost(host);
    let retVals = [];
    let remVals = [];
    let resVals = [];
    for (let i = 0; i < actions.length; i++)
    {
     let val = -1;
     if (prev !== null)
     {
      if (actions[i].id in prev)
       val = prev[actions[i].id];
     }
     if (val !== -1)
      remVals.push({id: actions[i].id, text: actions[i].text, value: val});
     else if (adpc_control.allBlocked())
      resVals.push({id: actions[i].id, text: actions[i].text, value: -1});
     else
      retVals.push({id: actions[i].id, text: actions[i].text, value: val});
    }
    if (retVals.length === 0)
    {
     let ret = {withdraw: ['*']};
     adpc_control.showEye(window, host);
     for (let i = 0; i < resVals.length; i++)
     {
      await adpc_api.setConsent(host, resVals[i].id, resVals[i].value, resVals[i].text);
      if (!adpc_control.allBlocked() && resVals[i].value === 1)
      {
       if (!ret.hasOwnProperty('consent'))
        ret.consent = [];
       ret.consent.push(resVals[i].id);
      }
     }
     for (let i = 0; i < remVals.length; i++)
     {
      if (remVals[i].value === 1)
      {
       if (!ret.hasOwnProperty('consent'))
        ret.consent = [];
       ret.consent.push(remVals[i].id);
      }
     }
     resolve(ret);
     return;
    }
    let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/prompt.properties');
    let singleDoorhanger = false;
    if (adpc_control._Prefs.prefHasUserValue('singleDoorhanger'))
     singleDoorhanger = adpc_control._Prefs.getBoolPref('singleDoorhanger');
    if (singleDoorhanger && retVals.length === 1)
    {
     let cleanText = retVals[0].text;
     cleanText = cleanText.replaceAll('"', '');
     while (cleanText.includes('\'\''))
     {
      cleanText = cleanText.replaceAll('\'\'', '\'');
     }
     let sPermissionSng = locale.formatStringFromName('permission.single', [adpc_api.baseDomain(host), cleanText], 2);
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
        retVals[0].value = 1;
        let ret = {withdraw: ['*']};
        adpc_control.showEye(window, host);
        for (let i = 0; i < retVals.length; i++)
        {
         await adpc_api.setConsent(host, retVals[i].id, retVals[i].value, retVals[i].text);
         if (retVals[i].value === 1)
         {
          if (!ret.hasOwnProperty('consent'))
           ret.consent = [];
          ret.consent.push(retVals[i].id);
         }
        }
        for (let i = 0; i < resVals.length; i++)
        {
         await adpc_api.setConsent(host, resVals[i].id, resVals[i].value, resVals[i].text);
         if (resVals[i].value === 1)
         {
          if (!ret.hasOwnProperty('consent'))
           ret.consent = [];
          ret.consent.push(resVals[i].id);
         }
        }
        for (let i = 0; i < remVals.length; i++)
        {
         if (remVals[i].value === 1)
         {
          if (!ret.hasOwnProperty('consent'))
           ret.consent = [];
          ret.consent.push(remVals[i].id);
         }
        }
        resolve(ret);
       }
      },
      [
       {
        label: sDeny,
        accessKey: kDeny,
        callback: async function()
        {
         retVals[0].value = 0;
         let ret = {withdraw: ['*']};
         adpc_control.showEye(window, host);
         for (let i = 0; i < retVals.length; i++)
         {
          await adpc_api.setConsent(host, retVals[i].id, retVals[i].value, retVals[i].text);
          if (retVals[i].value === 1)
          {
           if (!ret.hasOwnProperty('consent'))
            ret.consent = [];
           ret.consent.push(retVals[i].id);
          }
         }
         for (let i = 0; i < resVals.length; i++)
         {
          await adpc_api.setConsent(host, resVals[i].id, resVals[i].value, resVals[i].text);
          if (resVals[i].value === 1)
          {
           if (!ret.hasOwnProperty('consent'))
            ret.consent = [];
           ret.consent.push(resVals[i].id);
          }
         }
         for (let i = 0; i < remVals.length; i++)
         {
          if (remVals[i].value === 1)
          {
           if (!ret.hasOwnProperty('consent'))
            ret.consent = [];
           ret.consent.push(remVals[i].id);
          }
         }
         resolve(ret);
        }
       }
      ],
      {
       learnMoreURL: 'https://www.dataprotectioncontrol.org/'
      }
     );
     return;
    }
    let sPermissionPlr = locale.formatStringFromName('permission.plural', [adpc_api.baseDomain(host)], 1);
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
      callback: async function()
      {
       let ret = await adpc_control._jsDialog(wnd, host, actions);
       resolve(ret);
      }
     },
     [
      {
       label: sAllowAll,
       accessKey: kAllowAll,
       callback: async function()
       {
        let ret = {withdraw: ['*']};
        adpc_control.showEye(window, host);
        for (let i = 0; i < retVals.length; i++)
        {
         retVals[i].value = 1;
         await adpc_api.setConsent(host, retVals[i].id, retVals[i].value, retVals[i].text);
         if (!ret.hasOwnProperty('consent'))
          ret.consent = [];
         ret.consent.push(retVals[i].id);
        }
        for (let i = 0; i < resVals.length; i++)
        {
         await adpc_api.setConsent(host, resVals[i].id, resVals[i].value, resVals[i].text);
         if (resVals[i].value === 1)
         {
          if (!ret.hasOwnProperty('consent'))
           ret.consent = [];
          ret.consent.push(resVals[i].id);
         }
        }
        for (let i = 0; i < remVals.length; i++)
        {
         if (remVals[i].value === 1)
         {
          if (!ret.hasOwnProperty('consent'))
           ret.consent = [];
          ret.consent.push(remVals[i].id);
         }
        }
        resolve(ret);
       }
      },
      {
       label: sDenyAll,
       accessKey: kDenyAll,
       callback: async function()
       {
        let ret = {withdraw: ['*']};
        adpc_control.showEye(window, host);
        for (let i = 0; i < retVals.length; i++)
        {
         retVals[i].value = 0;
         await adpc_api.setConsent(host, retVals[i].id, retVals[i].value, retVals[i].text);
        }
        for (let i = 0; i < resVals.length; i++)
        {
         await adpc_api.setConsent(host, resVals[i].id, resVals[i].value, resVals[i].text);
         if (resVals[i].value === 1)
         {
          if (!ret.hasOwnProperty('consent'))
           ret.consent = [];
          ret.consent.push(resVals[i].id);
         }
        }
        for (let i = 0; i < remVals.length; i++)
        {
         if (remVals[i].value === 1)
         {
          if (!ret.hasOwnProperty('consent'))
           ret.consent = [];
          ret.consent.push(remVals[i].id);
         }
        }
        resolve(ret);
       }
      }
     ],
     {
      learnMoreURL: 'https://www.dataprotectioncontrol.org/'
     }
    );
   }
  );
  return p;
 },
 _jsDialog: async function(wnd, host, actions)
 {
  let prev = adpc_api.getHost(host);
  let retVals = [];
  let remVals = [];
  let resVals = [];
  for (let i = 0; i < actions.length; i++)
  {
   let val = -1;
   if (prev !== null)
   {
    if (actions[i].id in prev)
     val = prev[actions[i].id];
   }
   if (val !== -1)
    remVals.push({id: actions[i].id, text: actions[i].text, value: val});
   else if (adpc_control.allBlocked())
    resVals.push({id: actions[i].id, text: actions[i].text, value: -1});
   else
    retVals.push({id: actions[i].id, text: actions[i].text, value: val});
  }
  if (retVals.length > 0)
   window.openDialog('chrome://adpc/content/prompt.xul', '', 'chrome,dialog,resizable=no,alwaysRaised,modal,left=150,top=150', adpc_api.baseDomain(host), retVals);
  let ret = {withdraw: ['*']};
  adpc_control.showEye(window, host);
  for (let i = 0; i < retVals.length; i++)
  {
   await adpc_api.setConsent(host, retVals[i].id, retVals[i].value, retVals[i].text);
   if (retVals[i].value === 1)
   {
    if (!ret.hasOwnProperty('consent'))
     ret.consent = [];
    ret.consent.push(retVals[i].id);
   }
  }
  for (let i = 0; i < resVals.length; i++)
  {
   await adpc_api.setConsent(host, resVals[i].id, resVals[i].value, resVals[i].text);
   if (resVals[i].value === 1)
   {
    if (!ret.hasOwnProperty('consent'))
     ret.consent = [];
    ret.consent.push(resVals[i].id);
   }
  }
  for (let i = 0; i < remVals.length; i++)
  {
   if (remVals[i].value === 1)
   {
    if (!ret.hasOwnProperty('consent'))
     ret.consent = [];
    ret.consent.push(remVals[i].id);
   }
  }
  return ret;
 },
 makeHeader: function(hList)
 {
  let sConsent = '';
  for (id in hList)
  {
   if (!adpc_control.allBlocked() && hList[id] === 1)
   {
    if (sConsent === '')
     sConsent = id;
    else
     sConsent += ' ' + id;
   }
  }
  let hdr = 'withdraw=*';
  if (adpc_control._Prefs.prefHasUserValue('objectTo'))
   hdr += ', object="' + adpc_control._Prefs.getCharPref('objectTo') + '"';
  if (sConsent !== '')
   hdr += ', consent="' + sConsent + '"';
  if (hdr === 'withdraw=*')
   return false;
  return hdr;
 },
 progressListener: {
  onLocationChange: function(aProgress, aRequest, aLocation, aFlags)
  {
   if (aLocation.asciiHost === '')
   {
    adpc_control.hideEye(window);
    return;
   }
   let hList = adpc_api.getHost(aLocation.asciiHost);
   if (hList === null || Object.keys(hList).length === 0)
    adpc_control.hideEye(window);
   else
    adpc_control.showEye(window, aLocation.asciiHost);
  }
 },
 matchHost: function(wnd, host)
 {
  let matchedTab = false;
  for (let i = 0; i < wnd.gBrowser.tabs.length; i++)
  {
   if (!wnd.gBrowser.tabs[i].hasAttribute('selected') || wnd.gBrowser.tabs[i].getAttribute('selected') !== 'true')
    continue;
   if (!wnd.gBrowser.tabs[i].linkedBrowser.hasOwnProperty('registeredOpenURI'))
    continue;
   if (host === wnd.gBrowser.tabs[i].linkedBrowser.registeredOpenURI.asciiHost)
   {
    matchedTab = true;
    break;
   }
  }
  return matchedTab;
 },
 makeEye: function(wnd)
 {
  let urlBarIconsBox = wnd.document.getElementById('urlbar-icons');
  if (!urlBarIconsBox)
   return;
  let spaceHeight = urlBarIconsBox.clientHeight;
  let newIcon = wnd.document.createElement('image');
  newIcon.setAttribute('id', 'adpc-eye-button');
  newIcon.setAttribute('class', 'urlbar-icon');
  newIcon.setAttribute('style', 'overflow: hidden; display: none; padding: 0; margin-left: 3px; margin-right: 3px;');
  let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/adpc.properties');
  newIcon.setAttribute('tooltiptext', locale.GetStringFromName('eye.tooltip'));
  newIcon.setAttribute('onclick', 'BrowserPageInfo(null, \'permTab\');')
  let starButton = urlBarIconsBox.querySelector('#star-button');
  urlBarIconsBox.insertBefore(newIcon,starButton);
 },
 showEye: function(wnd, host)
 {
  if (!adpc_control.matchHost(wnd, host))
   return;
  let adpcEyeButton = wnd.document.getElementById('adpc-eye-button');
  if (!adpcEyeButton)
   return;
  adpcEyeButton.style.display = 'inline-block';
 },
 hideEye: function(wnd)
 {
  let adpcEyeButton = wnd.document.getElementById('adpc-eye-button');
  if (!adpcEyeButton)
   return;
  adpcEyeButton.style.display = 'none';
 },
 allBlocked: function()
 {
  if (adpc_control._Prefs.prefHasUserValue('blockAll'))
   return adpc_control._Prefs.getBoolPref('blockAll');
  return false;
 }
};

addEventListener('load', adpc_control.init, false);
