var adpc_option =
{
 _Prefs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getBranch('extensions.adpc.'),
 init: function()
 {
  let pAll = 0;
  if (adpc_option._Prefs.prefHasUserValue('forAll'))
   pAll = adpc_option._Prefs.getIntPref('forAll');
  let cAll = document.getElementById('cmbAll');
  cAll.value = pAll;
 },
 clear: async function()
 {
  let hList = await adpc_api._read(adpc_api._dbURLList, 'SELECT url, id, text FROM ' + adpc_api._dbURLList, {}, ['url', 'id', 'text']);
  let iCt = 0;
  if (hList !== false)
  {
   for (let i = 0; i < hList.length; i++)
   {
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
  let locale = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://adpc/locale/option.properties');
  if (iCt === 0)
   alert(locale.GetStringFromName('clear.none'));
  else
   alert(locale.formatStringFromName('clear.success', [iCt], 1));
 },
 save: function()
 {
  let cAll = document.getElementById('cmbAll');
  adpc_option._Prefs.setIntPref('forAll', cAll.value);
 }
};
