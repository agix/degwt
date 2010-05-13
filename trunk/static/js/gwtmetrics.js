/**
 * gwtmetrics is a utility to report metrics for any GWT application.
 * 
 * gwtmetrics can be included as a static library as follows - 
 * <pre>
 * <!--Include gwtmetrics.js just before GWTs nocache.js -->
 * <script src="/path/to/gwtmetrics.js"></script>
 * <script>
 * 	gwtmetrics('firebug');
 * </script>
 * <script src="module/module.nocache.js"></script>
 * </pre>
 * 
 * gwtmetrics can also be included dynamically as a bookmarklet, 
 * making it possible to get metrics for any running GWT application WITHOUT changing code.
 * 
 * gwtmetrics plugs into GWTs Lightweight Metrics System (http://code.google.com/webtoolkit/doc/latest/DevGuideLightweightMetrics.html)
 * The numbers are instrumented by GWT in every application, so gwtmetrics.js only does the job of listening, collating and reporting. 
 * 
 */
function gwtmetrics(loggerType) {
	var wnd = window;
	var doc = document;
	var collatedEvents = [];
	
	var getGWTContentWindows = function () {
		var toreturn = [];
		
		//Some GWT linkers put the javascript methods inline, and so we can test the window object 
		if (wnd.$gwt_version) {
			toreturn.push(wnd);
		}
		
		//but more frequently, the iframe linker puts all GWT methods in an iframe
		var iframes = doc.getElementsByTagName('iframe');
		for (var i=0; i<iframes.length; i++) {
			//important to put in a try/catch block, because third party iframes (read advertisements) will not be accessible  
			try {
				if(iframes[i].contentWindow.$gwt_version) {
					toreturn.push(iframes[i].contentWindow);
				}
			}
			catch(e) {}
		}
		
		return toreturn;
	};
	
	/**
	 * gwt is an array of contentWindow where GWT generated code resides.
	 * There will be one element per GWT module in this array. Usually, a host page has only 1 module, but sometimes it may have more than one. 
	 */
	var gwt = getGWTContentWindows();
	
	var logInFirebug = function(collatedEvent) {
		if (wnd.console && wnd.console.log) {
			var groupName;
			var numberOfSubEvents = collatedEvent.subEvents.length;
			if(numberOfSubEvents === 0) {
				return;
			}
			
			var lastSubEvent = collatedEvent.subEvents[numberOfSubEvents-1];
			var totalTime;
			if (collatedEvent.timedOut) {
				totalTime = 'TIMED OUT';
			}
			else {
				totalTime = lastSubEvent.time + 'ms';
			}
			
			if (collatedEvent.subSystem === 'rpc') {
				groupName = collatedEvent.evtGroup + '. ' + collatedEvent.method;
				groupName = groupName + ' ' + totalTime;
				groupName = groupName.replace('_Proxy', '');
			}
			else {
				groupName = collatedEvent.uniqueKey + ' ' + totalTime;
			}
			
			wnd.console.groupCollapsed(groupName);
			for (var i=0; i<numberOfSubEvents; i++) {
				var subEvent = collatedEvent.subEvents[i];
				wnd.console.log(subEvent.name + ' at ' + subEvent.time + 'ms');
			}
			wnd.console.groupEnd();
		}
	};
	
	var logInYui = function(event) {
		if (wnd.YAHOO && wnd.YAHOO.log) {
			wnd.YAHOO.log(event);
		}
	};
	
	var emptyLogger = function(event) {
		//do nothing
	};
	
	/**
	 * The logger to use to log events
	 */
	var log = (function() {
		if(loggerType.toLowerCase() === 'firebug') {
			return logInFirebug;
		}
		else if (loggerType.toLowerCase() === 'yui') {
			return logInYui;
		}
		else {
			return emptyLogger;
		}
	})();
	
	/*
	 * Returns true if all sub-events for the given collatedEvent have completed.
	 */
	var readyToLog = function(collatedEvent) {
		if(!collatedEvent) {
			return false;
		}
		var numberOfSubEvents = collatedEvent.subEvents.length;
		if (numberOfSubEvents === 0) {
			return false;
		}
		
		var lastSubEvent = collatedEvent.subEvents[numberOfSubEvents -1];
		//All known events end with 'end' -:).. 
		//Custom events may not follow this, and will be logged as TIMEOUT as we don't know when the end
		if(lastSubEvent.name === 'end') {
			return true;
		}
		else {
			return false;
		}
	};
	
	/*
	 * Groups events into buckets
	 */
	var collateEventsAndLog = function(event) {
		
		var evtGroup = event.evtGroup;
		var subSystem = event.subSystem;
		var subEventType = event.type;
		var method = event.method;
		var millis = event.millis;
		
		//Events are collated according to this key
		var uniqueKey = subSystem + '-' + evtGroup;
		if(method) {
			uniqueKey = uniqueKey + '-' + method;
		}
		
		var collatedEvent;
		var subEvent;
		
		/*
		 * Create a new, collatedEvent object.
		 * A collatedEvent has related sub-events.  
		 */
		if (!collatedEvents[uniqueKey]) {
			collatedEvents[uniqueKey] = {};
			collatedEvent = collatedEvents[uniqueKey]; 
			
			collatedEvent.uniqueKey = uniqueKey;
			collatedEvent.subSystem = subSystem;
			collatedEvent.evtGroup = evtGroup;
			if(method) {
				collatedEvent.method = method;
			}
			
			//We convert absolute timestamps to relative timestamps so that they become meaningful.
			collatedEvent.millis = millis;			
			collatedEvent.subEvents = [];
			
			subEvent = {};
			collatedEvent.subEvents.push(subEvent);
			subEvent.name = subEventType;
			subEvent.time = 0;
		}
		// Find the parent event, and append this sub-event to it.
		else {
			collatedEvent = collatedEvents[uniqueKey];
			subEvent = {};
			subEvent.name = subEventType;
			subEvent.time = millis - collatedEvent.millis;
			
			collatedEvent.subEvents.push(subEvent);
		}
		
		if(readyToLog(collatedEvent)) {
			log(collatedEvent);
			delete collatedEvents[uniqueKey];
		}
	};

	/*
	 * Set the global handler so that if GWT loads after our script, it will automatically register with us.
	 * This is a no-op if we are injecting gwt-metrics via a bookmarklet.
	 */
	wnd['__gwtStatsEvent'] = collateEventsAndLog;
	
	/*
	 * If we are loaded via a bookmarklet, GWT would have already started. We need to inject our collector method into every GWT iframe.s
	 * This is a no-op if the script is loaded before GWT loads.
	 */
	for(var i = 0; i <gwt.length; i++) {
		gwt[i].$stats = collateEventsAndLog;
	}
	
	/*
	 * Its possible that some events may not complete - due to network issues or due to javascript errors.
	 * This method will walk through all log events that are sitting in the collatedEvents queue for a long enough time.
	 */
	var removeDeadLogEntries = function() {
		var TIMEOUT_MILLIS = 20000;
		var currentTime = (new Date()).getTime();
		var collatedEvent;
		
		var isRpcComplete = function(subEvents) {
			return subEvents && (subEvents.length === 6);
		};
		
		// Iterate over all events. 
		// If all sub-events have completed, log the collated event		
		for (uniqueKey in collatedEvents) {
			//Check if the value is an object that we have defined
			if (collatedEvents.hasOwnProperty(uniqueKey) && collatedEvents[uniqueKey] && collatedEvents[uniqueKey].uniqueKey === uniqueKey) {
				collatedEvent = collatedEvents[uniqueKey];
			
				if((currentTime - collatedEvent.millis) > TIMEOUT_MILLIS) {
					collatedEvent.timedOut = true;
					log(collatedEvent);
					delete collatedEvents[uniqueKey];
				}
			}
		}
		wnd.setTimeout(removeDeadLogEntries, 1000);
	};
	//Call to ensure that the method is called every minute
	wnd.setTimeout(removeDeadLogEntries, 1000);	
}
