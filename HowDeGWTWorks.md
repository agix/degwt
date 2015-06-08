DeGWT is a javascript library that de-obfuscates GWT generated javascript code. In general, the code makes assumptions on how GWT generates code, and then uses them to generate unobfuscated code. This page documents these assumptions.



## Comparing Pretty and Obfuscated Javascript Code ##
GWT can generate javascript code in three styles - Obfuscated (default), Pretty and Detailed. Most of the reverse engineering is done by comparing the Pretty output to the Obfuscated output. Therefore, it is important to understand the pretty output.

In general, the difference between Pretty and Obfuscated javascript are the following -
  1. All classes and methods are renamed. Typically, classes and methods have 2 or 3 letter names.
  1. All strings are inlined. If pretty js has code like `$addString(streamWriter, 'greetServer')`, in obfuscated mode it will become something like `aG(pQ, rS);`.
  1. Here, the method `$addString` and the variable `streamWriter` were renamed, and the String "greetServer" was stored in a variable rS, and then the variable was used instead.

## Identifying GWT Code ##
GWT has a bootstrapping and selection script named `<module-name>.nocache.js`. This is the script that is embedded in the host html. This creates a hidden iframe, sniffs the browser and then loads the javascript _code specific to the browser_ in the hidden iframe. All GWT classes and functions are defined within this hidden Iframe.

GWT generated code always defines some variables - like `$gwt_version`, `$wnd` and `$doc`. The presence of any of these variables indicates that we are dealing with GWT.

So, to determine if a website is built on GWT, we do the following -
  1. See if `$gwt_version` is defined in the current window. If yes, `$gwt = window`
  1. Iterate over all Iframes and search for the variable $gwt\_version. If found, `$gwt = iframe.contentWindow`

At the end of this procedure, the global variable `$gwt` will point to GWTs namespace and will contain the obfuscated code. If `$gwt` is null, it is safe to assume the website doesn't use GWT.

## Representing Classes in Javascript ##
  1. Java Classes are represented as functions in GWT eg. `function Person(){}`
  1. The prototype property points to the parent class eg. `_ = Person.prototype = new Object_0;`
  1. Every class defines the `getClass$()` method and `typeId$` property.
  1. The `Object` class defines the 'equals()`, `toString()` and `hashCode()` method just like in java. If a particular class overrides it, then the corresponding java function will also override it.
  1. In Obfuscated mode, `getClass$()` becomes `gC()`, `equals()` becomes `eQ`, `hashCode` becomes 'hC` and `typeId` becomes `tI`.
  1. The class names are available by invoking the method `classObj.gC().toString()`.
  1. By inspecting the prototype chain, you can figure out the inheritance hierarchy of the class.
  1. Member variables can be identified by iterating over the function using the `for.. in` javascript construct; but because javascript isn't typesafe, the type of member variable cannot be determined easily. Also, in obfuscated mode, the member variables may have names like `a` and `b`, which don't make much sense.

## Identifying RPC Methods ##
  1. A RPC method in javascript has the signature `methodName(ServiceProxy, <RPC method parameters>, AsyncCallback)`
  1. The RPC method uses ServiceProxy to convert the remaining method parameters into a string payload.
  1. The payload contains the class and method name of the service, the class name and signature for each service parameter, the number of parameters, and then the serialized data for the parameters.
  1. Then, it invokes the $doInvoke method with the payload, callback and some additional parameters
  1. $doInvoke method makes the AJAX call, and calls the the callback when the data arrives.
  1. $doInvoke method has a `try/catch` block which throws an exception with the string literal "Unable to initiate the asynchronous service invocation -- check the network connection"
  1. Also, every RPC method plugin to the `Lightweight Metrics System` to report on the time taken for the method call. Based on the logging call, it is possible to identify the method and class name of the RPC Service.

Based on the above, the procedure to get the list of RPC methods is as follows -
  1. Find the global variable which has the interned string "Unable to initiate the asynchronous service invocation -- check the network connection"
  1. Find the method that references the variable found above. This is the $doInvoke() method.
  1. Find all methods that invoke the method found above. These are the RPC methods.
  1. This method will have a cryptic name - like `aEd()`. To find the de-obfuscated name, parse the call to `$stats` method call and obtain the class and method name.
  1. To get the method name, either parse the payload; or parse the call that is made to the `$stats` reporting system.
  1. The type of the parameters can be obtained from the calls to generate the payload.