/** 
 * filter() method iterates over all key/value pair in 'this', and then decides which key/value pairs to keep or discard.
 * The key/value pairs that must be kept are then returned as another FilterableObject.
 * 
 * Importantly - the decision to keep or discard a key/value pair is taken by a user defined function that is passed as a parameter.
 */
Object.prototype.filter =  function (filterFn) {
	var result = {};
	for(key in this) {
		if (this.hasOwnProperty(key)) {
			var value = this[key];
			if (filterFn(key, value)) {
				result[key] = value;
			}
		}
	}
	return result;
};

/**
 * map() iterates over all key/value pairs and transforms it to another key/value pair.
 * Essentially, 
 * {keyold1:valueold1, keyold2:valueold2} becomes {keynew1:valuenew1, keynew2:valuenew2}
 *  
 */
Object.prototype.map =  function (mapperFn) {
	var result = {};
	for(key in this) {
		if (this.hasOwnProperty(key)) {
			var value = this[key];
			var pair;
			pair = mapperFn(key, value);
			result[pair.key] = pair.value;
		}
	}
	return result;
};

/**
 * Reduce the object to a single string value 
 * reduceFn takes 3 parameters - key, value, and initialValue
 * Its job is to create a string representation of the key/value pair, append it to initialValue and return the newValue
 */
Object.prototype.reduce =  function (reducerFn, initialValue) {
	var result = initialValue;
	for(key in this) {
		if (this.hasOwnProperty(key)) {
			var value = this[key];
			result = reducerFn(key, value, result);
		}
	}
	return result;
};

/**
 * Utility method to get the first key in the FilterableOject
 */
Object.prototype.getFirstKey = function() {
	for (key in this) {
		if (this.hasOwnProperty(key)) {
			if (key == 'filter' || key == 'map' || key == 'getFirstKey') {
				continue;
			}
			return key;
		}
	}
	return null;
};


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
		gwt.filter = Object.prototype.filter;
		gwt.map = Object.prototype.map;
		gwt.getFirstKey = Object.prototype.getFirstKey;
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
	var $gwt = gwt;
	var that = this;
	

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
	var getRpcMethodPrettyName = function(obfMethodName, rpcMethod) {
		var regex = /stats\(.*,\s*method\s*:\s*([a-zA-Z0-9$_]*)\s*,/;
		var match = regex.exec(rpcMethod.toString());
		if(match != null && match.length > 1) {
			var constantName = match[1];
			var constantValue = $gwt[constantName];
			return '(' + obfMethodName + ') ' + constantValue.replace('_Proxy', '');
		}
		else {
			return '(' + obfMethodName + ') ';
		}
	}
	
	/**
	 * We return a pretty name for the class..
	 * The toString() method is defined on every object, so we just use it.
	 */
	var getClassPrettyName = function(obfClassName, classObj) {
		if(classObj && classObj.prototype && typeof(classObj.prototype.gC) === 'function' && classObj.prototype.gC()) {
			return '(' + obfClassName + ') ' + classObj.prototype.gC().toString();
		}
		return '(' + obfClassName + ') ';
	};
	
	/*
	 * Gets the number of parameters that the given function expects
	 */
	var getNumberOfParameters = function (methodName, methodObj) {
		var regex = /\s*function\s+([a-zA-Z$0-9]+)\s*\((.*)\)\s*{/;
		var match = regex.exec(methodObj.toString());
		if (match && match.length === 3 && match[1] === methodName) {
			return match[2].split(",").length;
		}
		else {
			throw {
                name: 'getNumberOfParameters',
                message : "Cannot find number of parameters for method " + methodName
            };
		}
	};
	
	/*
	 * Before trying to understand this method, read this obfuscated javascript
	 * 
	 * 
	 */
	var getRPCMethodFormalParameters = function(methodName, methodObj) {
		var numberOfRPCParameters = getNumberOfParameters(methodName, methodObj) - 2;
		
		var temp = $gwt.filter(function(key, value) {
			//if it is a variable whose value is numberOfRPCParameters ..
			if (typeof(value) === 'string' && value === ('' +numberOfRPCParameters)) {
				return true;
			}
			return false;
		});
		
		if (!temp || !temp.getFirstKey()) {
			throw {
				name: 'getRPCMethodFormalParameters',
                message : "Can't find the variable whose value is " + numberOfRPCParameters
			};
		}
		var constantName = temp.getFirstKey();
		
		var appendMethodNameRegex = new RegExp("([a-zA-Z0-9$]{2,4})\\([a-zA-Z$.]+\\s*,\\s*" + constantName + "\\s*\\);");
		temp = appendMethodNameRegex.exec(methodObj.toString());
		
		if(!temp || temp.length != 2) {
			throw {
				name: 'getRPCMethodFormalParameters',
                message : "Can't find the obfuscated name for method append()"
			};
		}
		
		var appendMethodName = temp[1];
		
		/*
		 * Now, find methods 
		 */
		return appendMethodName;
	};
	 
	/**
	 * Get all the RPC methods that can be found.
	 * Algorithm :
	 * 1) Get the variable that has the value "requestSent"
	 * 2) Get the method that contains the above variable. This is the $doInvoke() method in pretty mode
	 * 3) Get all the methods that invoke the above method. Any method that calls $doInvoke() is a RPC method
	 */
	this.getAllRPCMethods = function() {
		var literal = 'requestSent';
		var temp1 = $gwt.filter(function(key, value) {
			if(typeof(value) == 'string' && value === literal) {
				return true;
			}
			return false;
		});
		
		var variableName = temp1.getFirstKey();
		
		var temp2 = $gwt.filter(function(key, value) {
			if(typeof(value) == 'function' && value.toString().indexOf(variableName) != -1) {
				return true;
			}
			return false;
		});
		var doInvokeMethodName = temp2.getFirstKey();
		
		var rpcMethods = $gwt.filter(function(key, value) {
			if(typeof(value) == 'function' && key.indexOf(doInvokeMethodName) == -1 && value.toString().indexOf(doInvokeMethodName + '(') != -1) {
				return true;
			}
			return false;
		});
		
		return rpcMethods.map(function(obfMethodName, method) {
			var pair = {};
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
		var rawClasses = $gwt.filter(function(key, value) {
			try {
				if((typeof(value) == 'function') && typeof(value.prototype) == 'object' && typeof(value.prototype.eQ) == 'function') {
					return true;
				}
			}
			catch(e){}
			return false;
		});
		
		//return rawClasses;
		
		/*
		 * We'll try to identify the de-obfuscated class name over here
		 */
		var decoratedClasses = rawClasses.map(function(obfClassName, classObj) {
			var pair = {};
			pair.key = getClassPrettyName(obfClassName, classObj);
			pair.value = classObj;
			return pair;
		});
		
		return decoratedClasses;
	};
	
	this.getClassFromTypeId = function(typeId) {
		var matchingClasses = this.getAllClasses().filter(function(className, classObj){
			if(classObj.prototype.tI == typeId) {
				return true;
			}
			return false;
		});
		
		return matchingClasses.getFirstKey();
	};
	
	/**
	 * De-obfuscates the given method name and returns an Object containing the following information - 
	 * 	1) Pretty Name
	 *  2) Arguments with formal parameter types
	 *  3) De-obfuscated source of the method
	 *  
	 * @param methodName the obfuscated method name
	 * @return
	 */
	this.deObfuscateRPCMethod = function(methodName) {
		var method = $gwt[methodName];
		var result = {};
		
		if(!method) {
			return result;
		}
		
		result.name = {};
		result.name.obfuscated = methodName;
		result.name.pretty = getRpcMethodPrettyName(methodName, method);
		result.numberOfParameters = getNumberOfParameters(methodName, method);
		result.variableNameForNumberOfRPCParameters = getRPCMethodFormalParameters(methodName, method);
		
		return result;
	};
	
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
				if((typeof(value) == 'function') && typeof(value.prototype) == 'object' && typeof(value.prototype.equals$) == 'function') {
					return true;
				}
			}
			catch(e){}
			return false;
		});
		
		return rawClasses;
	};
	
	this.getClassFromTypeId = function(typeId) {
		var matchingClasses = this.getAllClasses().filter(function(className, classObj){
			if(classObj.prototype.typeId$ == typeId) {
				return true;
			}
			return false;
		});
		
		return matchingClasses.getFirstKey();
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
		
		/*TODO Introduce a reduce() method in Object*/
		var allMethods = $degwt.getAllRPCMethods();
		html += allMethods.reduce((function(key, value, buffer) {return buffer + " <option>" + key + "</option>";}), "");
		html += "</select>";
		return html;
	}
	
	function getAllClassesHtml() {
		var html;
		html = "Classes : <select>";
		
		/*TODO Introduce a reduce() method in Object*/
		var allMethods = $degwt.getAllClasses();
		html += allMethods.reduce((function(key, value, buffer) {return buffer + " <option>" + key + "</option>";}), "");

		html += "</select>";
		return html;
	}
};
new user_interface();
