if (globalThis.AdpcEvent === undefined)
{
 class AdpcEvent extends Event
 {
  constructor(type, options)
  {
   super(type);
   this.userDecisions = options;
  }
 }
 globalThis.AdpcEvent = AdpcEvent;
}
