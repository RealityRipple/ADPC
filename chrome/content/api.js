var adpc_api =
{
 _profPath: null,
 _dbName: 'adpc.sqlite',
 _dbIDList: 'adpc_ids',
 _dbURLList: 'adpc_urls',
 _dbStruct:
 {
  'adpc_ids': 'idx INTEGER PRIMARY KEY, name TEXT, value INTEGER',
  'adpc_urls': 'url TEXT, id INTEGER, text TEXT'
 },
 _db:
 {
  'adpc_ids': null,
  'adpc_urls': null
 },
 _read: async function(dbID, q, params, req)
 {
  if (adpc_api._profPath === null)
   adpc_api._profPath = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties).get('ProfD', Components.interfaces.nsIFile).path;
  let fFrom = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
  fFrom.initWithPath(adpc_api._profPath);
  fFrom.appendRelativePath(adpc_api._dbName);
  if(!fFrom.exists())
   return false;
  if (adpc_api._db[dbID] === null)
   adpc_api._db[dbID] = Components.classes['@mozilla.org/storage/service;1'].getService(Components.interfaces.mozIStorageService).openDatabase(fFrom);
  let p = new Promise((resolve, reject) => {
   let ret = [];
   let statement = adpc_api._db[dbID].createAsyncStatement(q);
   for (param in params)
   {
    statement.params[param] = params[param];
   }
   statement.executeAsync({
    handleResult: function(aResultSet)
    {
     let row;
     while (row = aResultSet.getNextRow())
     {
      let n = {};
      for (let i = 0; i < req.length; i++)
      {
       n[req[i]] = row.getResultByName(req[i]);
      }
      ret.push(n);
     }
    },
    handleError: function(aError)
    {
     reject(aError.message);
    },
    handleCompletion: function(aReason)
    {
     resolve(ret);
    }
   });
   statement.finalize();
  });
  let bData = await p.catch(function(err) {console.log(err);});
  if (typeof bData === 'undefined' || bData === null)
   return false;
  return bData;
 },
 _read_sync: function(dbID, q, params, req)
 {
  if (adpc_api._profPath === null)
   adpc_api._profPath = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties).get('ProfD', Components.interfaces.nsIFile).path;
  let fFrom = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
  fFrom.initWithPath(adpc_api._profPath);
  fFrom.appendRelativePath(adpc_api._dbName);
  if(!fFrom.exists())
   return false;
  if (adpc_api._db[dbID] === null)
   adpc_api._db[dbID] = Components.classes['@mozilla.org/storage/service;1'].getService(Components.interfaces.mozIStorageService).openDatabase(fFrom);
  let ret = [];
  let statement = adpc_api._db[dbID].createStatement(q);
  for (param in params)
  {
   statement.params[param] = params[param];
  }
  while (statement.executeStep())
  {
   let n = {};
   for (let i = 0; i < req.length; i++)
   {
    n[req[i]] = statement.row[req[i]];
   }
   ret.push(n);
  }
  statement.finalize();
  return ret;
 },
 _write: async function(dbID, q, params)
 {
  if (adpc_api._profPath === null)
   adpc_api._profPath = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties).get('ProfD', Components.interfaces.nsIFile).path;
  let fFrom = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
  fFrom.initWithPath(adpc_api._profPath);
  fFrom.appendRelativePath(adpc_api._dbName);
  let create = !fFrom.exists();
  if (adpc_api._db[dbID] === null)
   adpc_api._db[dbID] = Components.classes['@mozilla.org/storage/service;1'].getService(Components.interfaces.mozIStorageService).openDatabase(fFrom);
  if (create || !adpc_api._db[dbID].tableExists(dbID))
  {
   let struct = adpc_api._dbStruct[dbID];
   adpc_api._db[dbID].createTable(dbID, struct);
  }
  let p = new Promise((resolve, reject) => {
   let statement = adpc_api._db[dbID].createAsyncStatement(q);
   for (let i = 0; i < params.length; i++)
   {
    if (typeof params[i] === 'number')
     statement.bindInt64Parameter(i, params[i]);
    else
     statement.bindUTF8StringParameter(i, params[i]);
   }
   statement.executeAsync({
    handleError: function(aError)
    {
     reject(aError.message);
    },
    handleCompletion: function(aReason)
    {
     resolve(true);
    }
   });
   statement.finalize();
  });
  let bRet = await p.catch(function(err) {console.log(err);});
  if (typeof bRet === 'undefined' || bRet === null)
   return false;
  return true;
 },
 getHost: function(host)
 {
  let lRows = adpc_api._read_sync(adpc_api._dbURLList, 'SELECT id FROM ' + adpc_api._dbURLList + ' WHERE url = :url', {'url': host}, ['id']);
  if (lRows === false)
   return null;
  let rList = {};
  for (let i = 0; i < lRows.length; i++)
  {
   let idx = lRows[i].id;
   let pRows = adpc_api._read_sync(adpc_api._dbIDList, 'SELECT name, value FROM ' + adpc_api._dbIDList + ' WHERE idx = :idx', {'idx': idx}, ['name', 'value']);
   if (pRows === false)
    continue;
   if (pRows.length !== 1)
    continue;
   rList[pRows[0].name] = pRows[0].value;
  }
  return rList;
 },
 getHostsFromIDX: function(idx)
 {
  let lRows = adpc_api._read_sync(adpc_api._dbURLList, 'SELECT url FROM ' + adpc_api._dbURLList + ' WHERE id = :id', {'id': idx}, ['url']);
  if (lRows === null)
   return [];
  let rList = [];
  for (let i = 0; i < lRows.length; i++)
  {
   rList.push(lRows[i].url);
  }
  return rList;
 },
 isStandardID: function(name)
 {
  if (name.slice(0, 7) === 'http://')
   return true;
  if (name.slice(0, 8) === 'https://')
   return true;
  return false;
 },
 getStandardID: async function(name)
 {
  let pRows = await adpc_api._read(adpc_api._dbIDList, 'SELECT idx FROM ' + adpc_api._dbIDList + ' WHERE name = :name', {'name': name}, ['idx']);
  if (pRows === null)
   return null;
  if (pRows.length !== 1)
   return null;
  return pRows[0].idx;
 },
 getConsent: async function(host, name)
 {
  let lRows = await adpc_api._read(adpc_api._dbURLList, 'SELECT id FROM ' + adpc_api._dbURLList + ' WHERE url = :url', {'url': host}, ['id']);
  if (lRows === null)
   return -1;
  let rList = {};
  for (let i = 0; i < lRows.length; i++)
  {
   let idx = lRows[i].id;
   let pRows = await adpc_api._read(adpc_api._dbIDList, 'SELECT name, value FROM ' + adpc_api._dbIDList + ' WHERE idx = :idx', {'idx': idx}, ['name', 'value']);
   if (pRows === null)
    continue;
   for (let j = 0; j < pRows.length; j++)
   {
    if (pRows[j].name === name)
     return pRows[j].value;
   }
  }
  return -1;
 },
 getConsentFromIDX: async function(idx)
 {
  let pRows = await adpc_api._read(adpc_api._dbIDList, 'SELECT name, value FROM ' + adpc_api._dbIDList + ' WHERE idx = :idx', {'idx': idx}, ['name', 'value']);
  if (pRows === null)
   return null;
  if (pRows.length !== 1)
   return null;
  return pRows[0];
 },
 getConsentID: async function(host, name)
 {
  if (adpc_api.isStandardID(name))
  {
   let idx = await adpc_api.getStandardID(name);
   if (idx !== null)
    return idx;
  }
  let lRows = await adpc_api._read(adpc_api._dbURLList, 'SELECT id FROM ' + adpc_api._dbURLList + ' WHERE url = :url', {'url': host}, ['id']);
  if (lRows === null)
   return null;
  let rList = {};
  for (let i = 0; i < lRows.length; i++)
  {
   let idx = lRows[i].id;
   let pRows = await adpc_api._read(adpc_api._dbIDList, 'SELECT name, value FROM ' + adpc_api._dbIDList + ' WHERE idx = :idx', {'idx': idx}, ['name', 'value']);
   if (pRows === null)
    continue;
   for (let j = 0; j < pRows.length; j++)
   {
    if (pRows[j].name === name)
     return idx;
   }
  }
  return null;
 },
 makeConsentID: async function()
 {
  let newIDX = null;
  let rList = await adpc_api._read(adpc_api._dbIDList, 'SELECT idx FROM ' + adpc_api._dbIDList, {}, ['idx']);
  if (rList === null)
   newIDX = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  else
  {
   let found = false;
   do
   {
    newIDX = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    found = false;
    for (let n = 0; n < rList.length; n++)
    {
     if (rList[n].idx === newIDX)
     {
      found = true;
      break;
     }
    }
   } while(found);
  }
  return newIDX;
 },
 getLabel: async function(host, name)
 {
  let lRows = await adpc_api._read(adpc_api._dbURLList, 'SELECT id, text FROM ' + adpc_api._dbURLList + ' WHERE url = :url', {'url': host}, ['id', 'text']);
  if (lRows === null)
   return null;
  let rList = {};
  for (let i = 0; i < lRows.length; i++)
  {
   let idx = lRows[i].id;
   let pRows = await adpc_api._read(adpc_api._dbIDList, 'SELECT name FROM ' + adpc_api._dbIDList + ' WHERE idx = :idx', {'idx': idx}, ['name']);
   if (pRows === null)
    continue;
   for (let j = 0; j < pRows.length; j++)
   {
    if (pRows[j].name === name)
     return lRows[i].text;
   }
  }
  return null;
 },
 setConsent: async function(host, name, val, label)
 {
  let idx = await adpc_api.getConsentID(host, name);
  if (idx !== null)
  {
   let oldVal = await adpc_api.getConsent(host, name);
   if (val === oldVal)
    return idx;
  }
  if (adpc_api.isStandardID(name))
  {
   if (idx === null)
   {
    idx = await adpc_api.makeConsentID();
    let stdInsertID = await adpc_api._write(adpc_api._dbIDList, 'INSERT OR REPLACE INTO ' + adpc_api._dbIDList + ' (idx, name, value) VALUES (?1, ?2, ?3)', [idx, name, val]);
    if (!stdInsertID)
     return false;
    let stdInsertURL = await adpc_api._write(adpc_api._dbURLList, 'INSERT INTO ' + adpc_api._dbURLList + ' (url, id, text) VALUES (?1, ?2, ?3)', [host, idx, label]);
    if (!stdInsertURL)
     return false;
    adpc_api._consentEvent(host);
    return idx;
   }
   let stdUpdateID = await adpc_api._write(adpc_api._dbIDList, 'UPDATE ' + adpc_api._dbIDList + ' SET value = ?2 WHERE idx = ?1', [idx, val]);
   if (!stdUpdateID)
    return false;
   if (label !== null)
   {
    let lHosts = await adpc_api._read(adpc_api._dbURLList, 'SELECT * FROM ' + adpc_api._dbURLList + ' WHERE url = :url AND id = :id', {'url': host, 'id': idx}, ['url', 'id', 'text']);
    if (lHosts === false || lHosts.length === 0)
    {
     let stdUpdInsertURL = await adpc_api._write(adpc_api._dbURLList, 'INSERT INTO ' + adpc_api._dbURLList + ' (url, id, text) VALUES (?1, ?2, ?3)', [host, idx, label]);
     if (!stdUpdInsertURL)
      return false;
    }
    else
    {
     let stdUpdateURL = await adpc_api._write(adpc_api._dbURLList, 'UPDATE ' + adpc_api._dbURLList + ' SET text = ?3 WHERE url = ?1 AND id = ?2', [host, idx, label]);
     if (!stdUpdateURL)
      return false;
    }
   }
   adpc_api._consentEvent(host);
   return idx;
  }
  if (idx !== null)
  {
   let updateID = await adpc_api._write(adpc_api._dbIDList, 'UPDATE ' + adpc_api._dbIDList + ' SET value = ?1 WHERE idx = ?2', [val, idx]);
   if (!updateID)
    return false;
   if (label !== null)
   {
    let updateURL = await adpc_api._write(adpc_api._dbIDList, 'UPDATE ' + adpc_api._dbURLList + ' SET text = ?1 WHERE id = ?2', [label, idx]);
    if (!updateURL)
     return false;
   }
   adpc_api._consentEvent(host);
   return idx;
  }
  idx = await adpc_api.makeConsentID();
  let insertID = await adpc_api._write(adpc_api._dbIDList, 'INSERT INTO ' + adpc_api._dbIDList + ' (idx, name, value) VALUES (?1, ?2, ?3)', [idx, name, val]);
  if (!insertID)
   return false;
  let insertURL = await adpc_api._write(adpc_api._dbURLList, 'INSERT INTO ' + adpc_api._dbURLList + ' (url, id, text) VALUES (?1, ?2, ?3)', [host, idx, label]);
  if (!insertURL)
   return false;
  adpc_api._consentEvent(host);
  return idx;
 },
 setConsentByIDX: async function(idx, val)
 {
  let oldVal = await adpc_api.getConsentFromIDX(idx);
  if (oldVal !== null)
  {
   if (oldVal.value === val)
    return idx;
  }
  let ret = await adpc_api._write(adpc_api._dbIDList, 'UPDATE ' + adpc_api._dbIDList + ' SET value = ?1 WHERE idx = ?2', [val, idx]);
  if (!ret)
   return false;
  let hosts = adpc_api.getHostsFromIDX(idx);
  for (let i = 0; i < hosts.length; i++)
  {
   adpc_api._consentEvent(hosts[i]);
  }
  return idx;
 },
 withdrawConsent: async function(host, name)
 {
  if (adpc_api.isStandardID(name))
  {
   let idx = await adpc_api.getStandardID(name);
   if (idx !== null)
   {
    await adpc_api._write(adpc_api._dbURLList, 'DELETE FROM ' + adpc_api._dbURLList + ' WHERE id = ?1', [idx]);
    await adpc_api._write(adpc_api._dbIDList, 'DELETE FROM ' + adpc_api._dbIDList + ' WHERE idx = ?1', [idx]);
    adpc_api._consentEvent(host);
    return;   
   }
  }
  let lRows = await adpc_api._read(adpc_api._dbURLList, 'SELECT id FROM ' + adpc_api._dbURLList + ' WHERE url = :url', {'url': host}, ['id']);
  if (lRows === null)
   return;
  let changed = false;
  for (let i = 0; i < lRows.length; i++)
  {
   let idx = lRows[i].id;
   let pRows = await adpc_api._read(adpc_api._dbIDList, 'SELECT name FROM ' + adpc_api._dbIDList + ' WHERE idx = :idx', {'idx': idx}, ['name']);
   if (pRows === null)
    continue;
   if (pRows.length !== 1)
    continue;
   if (pRows[0].name === name)
   {
    await adpc_api._write(adpc_api._dbIDList, 'DELETE FROM ' + adpc_api._dbIDList + ' WHERE idx = ?1', [idx]);
    await adpc_api._write(adpc_api._dbURLList, 'DELETE FROM ' + adpc_api._dbURLList + ' WHERE url = ?1 AND id = ?2', [host, idx]);
    changed = true;
   }
  }
  if (changed)
   adpc_api._consentEvent(host);
 },
 _consentEvent: function(host)
 {
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
    if (bri.currentURI.asciiHost !== host)
     continue;
    if (wnd.navigator.wrappedJSObject.dataProtectionControl === undefined)
     continue;
    let decisions = {withdraw: ['*']};
    let prev = adpc_api.getHost(host);
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
    let prefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getBranch('extensions.adpc.');
    if (prefs.prefHasUserValue('objectTo'))
     decisions.object = prefs.getCharPref('objectTo').split(' ');
    let evt = new wnd.CustomEvent('decisionchange', {detail: decisions});
    wnd.navigator.wrappedJSObject.dataProtectionControl.dispatchEvent(evt);
   }
  }
 }
};
