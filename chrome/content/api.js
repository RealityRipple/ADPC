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
   adpc_api._db[dbID] = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService).openDatabase(fFrom);
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
   adpc_api._db[dbID] = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService).openDatabase(fFrom);
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
   adpc_api._db[dbID] = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService).openDatabase(fFrom);
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
  if (adpc_api.isStandardID(name))
  {
   if (idx === null)
    idx = await adpc_api.makeConsentID();
   let inserted = await adpc_api._write(adpc_api._dbIDList, 'INSERT OR REPLACE INTO ' + adpc_api._dbIDList + ' (idx, name, value) VALUES (?1, ?2, ?3)', [idx, name, val]);
   if (!inserted)
    return false;
   let hosted = await adpc_api._write(adpc_api._dbURLList, 'INSERT INTO ' + adpc_api._dbURLList + ' (url, id, text) VALUES (?1, ?2, ?3)', [host, idx, label]);
   if (!hosted)
    return false;
   return idx;
  }
  if (idx !== null)
  {
   let updated = await adpc_api._write(adpc_api._dbIDList, 'UPDATE ' + adpc_api._dbIDList + ' SET value = ?1 WHERE idx = ?2', [val, idx]);
   if (!updated)
    return false;
   if (label !== null)
   {
    let hostupdated = await adpc_api._write(adpc_api._dbIDList, 'UPDATE ' + adpc_api._dbURLList + ' SET text = ?1 WHERE id = ?2', [label, idx]);
    if (!hostupdated)
     return false;
   }
   return idx;
  }
  idx = await adpc_api.makeConsentID();
  let inserted = await adpc_api._write(adpc_api._dbIDList, 'INSERT INTO ' + adpc_api._dbIDList + ' (idx, name, value) VALUES (?1, ?2, ?3)', [idx, name, val]);
  if (!inserted)
   return false;
  let hosted = await adpc_api._write(adpc_api._dbURLList, 'INSERT INTO ' + adpc_api._dbURLList + ' (url, id, text) VALUES (?1, ?2, ?3)', [host, idx, label]);
  if (!hosted)
   return false;
  return idx;
 },
 withdrawConsent: async function(host, name)
 {
  if (adpc_api.isStandardID(name))
  {
   let idx = await adpc_api.getStandardID(name);
   await adpc_api._write(adpc_api._dbURLList, 'DELETE FROM ' + adpc_api._dbURLList + ' WHERE id = ?1', [idx]);
   await adpc_api._write(adpc_api._dbIDList, 'DELETE FROM ' + adpc_api._dbIDList + ' WHERE idx = ?1', [idx]);
   return;   
  }
  let lRows = await adpc_api._read(adpc_api._dbURLList, 'SELECT id FROM ' + adpc_api._dbURLList + ' WHERE url = :url', {'url': host}, ['id']);
  if (lRows === null)
   return;
  let pFound = 0;
  for (let i = 0; i < lRows.length; i++)
  {
   let idx = lRows[i].id;
   let pRows = await adpc_api._read(adpc_api._dbIDList, 'SELECT name FROM ' + adpc_api._dbIDList + ' WHERE idx = :idx', {'idx': idx}, ['name']);
   if (pRows === null)
    continue;
   if (pRows.length !== 1)
    continue;
   if (pRows[0].name === name)
    await adpc_api._write(adpc_api._dbIDList, 'DELETE FROM ' + adpc_api._dbIDList + ' WHERE idx = ?1', [idx]);
   else
    pFound++;
  }
  if (pFound === 0)
   await adpc_api._write(adpc_api._dbURLList, 'DELETE FROM ' + adpc_api._dbURLList + ' WHERE url = ?1', [host]);
 }
};