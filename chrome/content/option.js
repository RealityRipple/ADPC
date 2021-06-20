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
 clear: function()
 {
  let hCount = {value: null};
  let hList = adpc_option._Prefs.getChildList('', hCount);
  let iCt = 0;
  for (let i = 0; i < hList.length; i++)
  {
   if (hList[i] === 'forAll')
    continue;
   adpc_option._Prefs.clearUserPref(hList[i]);
   iCt++;
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
