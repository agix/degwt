/**
 * FilterableObject is a regular object with the additional method map() and filter()
 * If you know functional programming, they should be familiar to you.
 */
function FilterableObject() {}
/** 
 * filter() method iterates over all key/value pair in 'this', and then decides which key/value pairs to keep or discard.
 * The key/value pairs that must be kept are then returned as another FilterableObject.
 * 
 * Importantly - the decision to keep or discard a key/value pair is taken by a user defined function that is passed as a parameter.
 */
FilterableObject.prototype.filter =  function (filterFn) {
	var result = new FilterableObject();
	for(key in this) {
		var value = this[key];
		if (filterFn(key, value)) {
			result[key] = value;
		}
	}
	return result;
};

/**
 * map() iterates over all key/value pairs and transforms it to another key/value pair.
 * Essentially, 
 * FilterableObject(key1s,value1s) becomes FilterableObject(key2s, value2s)
 *  
 */
FilterableObject.prototype.map =  function (mapperFn) {
	var result = new FilterableObject();
	for(key in this) {
		var value = this[key];
		var pair;
		pair = mapperFn(key, value);
		result[pair.key] = pair.value;
	}
	return result;
};

/**
 * Utility method to get the first key in the FilterableOject
 */
FilterableObject.prototype.getFirstKey = function() {
	for (key in this) {
		if (key == 'filter') {
			continue;
		}
		return key;
	}
};

/*
 * Utility method to check if text is empty
 */
function isEmpty(text) {
	if( typeof(text) == undefined || text == null || text == "" ) {
		return true;
	}
	return false;
}

/**
 * Gets the handle to gwt contentWindow
 * ASSUMPTION : GWT contentWindow always has the variable $gwt_version
 */
function getGWT() {
	var gwt;
	//Some GWT linkers put the javascript methods inline, and so we can test the window object 
	if (window.$gwt_version) {
		gwt = window;
	}
	else {
		//but more frequently, the iframe linker puts all GWT methods in an iframe
		var iframes = document.getElementsByTagName('iframe');
		for (var i=0; i<iframes.length; i++) {
			//important to put in a try/catch block, because third party iframes (read advertisements) will not be accessible  
			try {
				if(iframes[i].contentWindow.$gwt_version) {
					gwt = iframes[i].contentWindow;
					break;
				}
			}
			catch(e) {}
		}
	}
	
	if(gwt) {
		//Add the filter() and map() methods to the $gwt object, so that we can chain filter() and map() method calls
		gwt.filter = FilterableObject.prototype.filter;
		gwt.map = FilterableObject.prototype.map;
	}
	return gwt;
}

/**
 * Gets the mode in which java->javascript compilation was performed.
 * There are 3 modes - pretty, detailed and obfuscated
 */
function getCompileMode() {
	var gwt = getGWT();
	//In Pretty mode, we will always find nullMethod()
	if(gwt.nullMethod) {
		return 'pretty';
	}
	//TODO - we should also check for detailed mode, but for now lets assume != Pretty means Obfuscated
	else {
		return 'obfuscated';
	}
}

/**
 * Class to obtain decompiled information from the underlying gwt object.
 * This class works only when compiled in obfuscated mode. 
 * 
 * NOTE : This class should be kept in sync with degwt_pretty.
 * 
 * @param gwt the underlying gwt object containing obfuscated methods/classes/variables
 * @return
 */
function degwt_obf(gwt) {
	this.$gwt = gwt;

	/**
	 * Get all the RPC methods that can be found.
	 * Algorithm :
	 * 1) Get the variable that has the value "check the network connection"
	 * 2) Get the method that contains the above variable. This is the $doInvoke() method in pretty mode
	 * 3) Get all the methods that invoke the above method. Any method that calls $doInvoke() is a RPC method
	 */
	this.getAllRPCMethods = function() {
		var literal = 'check the network connection';
		var temp1 = this.$gwt.filter(function(key, value) {
			if(typeof(value) == 'string' && value.indexOf(literal) != -1) {
				return true;
			}
			return false;
		});
		
		var variableName = temp1.getFirstKey();
		
		var temp2 = this.$gwt.filter(function(key, value) {
			if(typeof(value) == 'function' && value.toString().indexOf(variableName) != -1) {
				return true;
			}
			return false;
		});
		var doInvokeMethodName = temp2.getFirstKey();
		
		var rpcMethods = this.$gwt.filter(function(key, value) {
			if(typeof(value) == 'function' && key.indexOf(doInvokeMethodName) == -1 && value.toString().indexOf(doInvokeMethodName + '(') != -1) {
				return true;
			}
			return false;
		});
		
		return rpcMethods.map(function(obfMethodName, method) {
			var pair = new Object();
			pair.key = getRpcMethodPrettyName(obfMethodName, method);
			pair.value = method;
			return pair;
		});
	};
	
	/**
	 * Gets all Classes that have been defined in the script.
	 * Assumptions -
	 * 1) All GWT classes have the equals() method. In obfuscated mode, this is abbreviated as eQ()
	 * 2) The presence of eQ() method in the prototype is sufficient to indicate this is a java class that has been translated to javascript.
	 * 
	 * Algorithm
	 * 1) Find all objects that have the equals() method (see above)
	 * 2) Return the objects after trying to find the de-obfuscated classname
	 */
	this.getAllClasses = function(){
		var rawClasses = this.$gwt.filter(function(key, value) {
			try {
				if((typeof(value) == 'function') && typeof(value.prototype) == 'object' && typeof(value.prototype.eQ) == 'function') {
					return true;
				}
			}
			catch(e){}
			return false;
		});
		
		/*
		 * We'll try to identify the de-obfuscated class name over here
		 */
		var decoratedClasses = rawClasses.map(function(obfClassName, classObj) {
			var pair = new Object();
			pair.key = getClassPrettyName(obfClassName, classObj);
			pair.value = classObj;
			return pair;
		});
		
		return decoratedClasses;
	};
	
	/**
	 * Gets the pretty name for a RPC Method
	 * Assumption : 
	 * 1) Every RPC method has a logger like this -
	 * !!$stats&&$stats({moduleName:$moduleName,sessionId:$sessionId,subSystem:pH,evtGroup:g,method:$H,millis:(new Date).getTime(),type:_H});
	 * 
	 * 2) We then match the string "method:$H", and extract $H
	 * 3) $H is a constant defined as a global variable, so we get the value of $H
	 * 4) The value of $H will be something like GreetingService_Proxy.greetServer 
	 * 5) We don't like the _Proxy, so we replace it with the empty string  
	 */
	function getRpcMethodPrettyName(obfMethodName, rpcMethod) {
		var regex = /stats\(.*,\s*method\s*:\s*([a-zA-Z0-9$_]*)\s*,/;
		var match = regex.exec(rpcMethod.toString());
		if(match != null && match.length > 1) {
			var constantName = match[1];
			var constantValue = $gwt[constantName];
			return constantValue.replace('_Proxy', '');
		}
		else {
			return obfMethodName;
		}
	}
	
	/**
	 * We return a pretty name for the class..
	 * The toString() method is defined on every object, so we just use it.
	 */
	function getClassPrettyName(obfClassName, classObj) {
		if((typeof(classObj) == 'function') && typeof(classObj.prototype) == 'object' && typeof(classObj.prototype.gC) == 'function') {
			var className = classObj.prototype.gC();
			if (className && className.toString) {
				return className.toString();
			}
		}
		
		return obfClassName;		
	}
};

/**
 * Class to obtain decompiled information from the underlying gwt object.
 * This class works only when compiled in pretty mode. 
 * 
 * NOTE : This class should be kept in sync with degwt_obf.
 * 
 * @param gwt the underlying gwt object containing pretty methods/classes/variables
 * @return
 */
function degwt_pretty(gwt) {
	this.$gwt = gwt;

	/*
	 * Get all the RPC methods that can be found.
	 * Algorithm :
	 * 1) Get all the methods that invoke the $doInvoke() method.
	 */
	this.getAllRPCMethods = function() {
		var doInvokeMethodName = "$doInvoke";
		var rpcMethods = this.$gwt.filter(function(key, value) {
			if(typeof(value) == 'function' && key.indexOf(doInvokeMethodName) == -1 && value.toString().indexOf(doInvokeMethodName + '(') != -1) {
				return true;
			}
			return false;
		});
		return rpcMethods;
	};
};

/**
 * We have two global variables 
 * $gwt   gives access to the obfuscated methods generated by gwt
 * $degwt gives access to the decompile/deobfuscated methods generated by our script
 */
var $gwt = getGWT();
var $degwt; 
if ($gwt) {
	if (getCompileMode() == 'pretty') {
		$degwt = new degwt_pretty($gwt); 
	}
	else {
		$degwt = new degwt_obf($gwt);
	}	
}


/*
 * ****************** *************************************
 * User Interface - should perhaps move in its own JS file
 * ****************** *************************************
 */
function user_interface() 
{
	//Instantiate and configure Loader:
	var loader = new YAHOO.util.YUILoader({
		require: ["container"],
	    loadOptional: true,
	    onSuccess: loadUI,
	    timeout: 15000,
	    combine: true
	});
	
	loader.insert();
	
	function loadUI() {
		var containerDiv = document.createElement('DIV');	
		YAHOO.util.Dom.addClass(containerDiv, 'yui-skin-sam');
		document.body.appendChild(containerDiv);
		
		myPanel = new YAHOO.widget.Panel('degwt', {
		  width: "600px",
		  constraintoviewport: false, 
		  fixedcenter : true,
		  underlay: "shadow", 
		  close: true,
		  visible: false, 
		  draggable: true
		});
		
		myPanel.setHeader("Deobfuscated GWT Code");
		myPanel.setBody(generateHTML());
		myPanel.render(containerDiv);
		myPanel.show();
	}
	
	function generateHTML() {
		if($gwt && $degwt) {
			var html;
			html = "<div>";
				html += "<div>";
				html += getRPCMethodsHtml();
				html += "</div>";
	
				html += "<div>";
				html += getAllClassesHtml();
				html += "</div>";
			html += "</div>";
			
			return html;
		}
		else {
			return "Website doesn't seem to use GWT";
		}		
	}
	
	function getRPCMethodsHtml() {
		var html;
		html = "RPC Methods : <select>";
		
		/*TODO Introduce a reduce() method in FilterableObject*/
		var allMethods = $degwt.getAllRPCMethods();
		for(key in allMethods) {
			var value = allMethods[key];
			if (canSkipMethod(key)) {
				continue;
			}
			
			html += "<option>";
			html += key;
			html += "</option>";
		}
		html += "</select>";
		return html;
	}
	
	function getAllClassesHtml() {
		var html;
		html = "Classes : <select>";
		
		/*TODO Introduce a reduce() method in FilterableObject*/
		var allMethods = $degwt.getAllClasses();
		for(key in allMethods) {
			var value = allMethods[key];
			if (canSkipMethod(key)) {
				continue;
			}			
			if(key.indexOf("java") != -1) {
				continue;
			}
			if(key.indexOf("google") != -1) {
				continue;
			}
			
			html += "<option>";
			html += key;
			html += "</option>";
		}
		html += "</select>";
		return html;
	}
	
	/*
	 * UGLY HACK - Move it to FilterableObject somehow.. 
	 * potentially combine it with the new reduce() method
	 */
	function canSkipMethod(methodName) {
		if(methodName == 'filter' || methodName == 'map' || methodName == 'getFirstKey') {
			return true;
		}
		return false;
	}
};
new user_interface();