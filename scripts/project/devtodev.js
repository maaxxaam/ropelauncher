function initDevtodev(platform, player)
{
	// choose key for init. If neither VK nor OK platform, init with Yandex key 
	var vk_key = "ak-Xps2eA9bfUHP60ti5ZogTzljxdGaN8Dy"; 
	var ok_key = "ak-01ElkNFD5RiwPStcsphMaLHBbUTAYq7G"; 
	var ya_key = "ak-RyvCowHOKEer5INq3uXBUYf2n0J7QMkz";
	var key = platform == "VK" ? vk_key : platform == "OK" ? ok_key : ya_key;
	console.log("Platform: " + platform); 
	var appData = { "appVersion" : "1.0.2" };
	devtodev.init(key, player); 
	devtodev.setAppData(appData);
	return "Initialized devtodev";
}

function d2d_setLevel(new_level){
    // Sets player's level to some number. 
	// Warning: it does not count as progression! 
	// Use it only for initialization.
    devtodev.setCurrentLevel(new_level); 
	return "Set level to" + new_level;
}

function d2d_lvlUp(new_level){ 
    // Levels player up to some new level.
    devtodev.levelUp(new_level); return "Level up to " + new_level;
}

function d2d_onPayment(id, name, price, type, amount, currency, cur_amount) { 
    // Tell devtodev about successful IAP. 
	// Call only when IAP was successful. 
	// Note: only 30 currencies per project. 
	// To-do: support up to 10 currencies.
    devtodev.realPayment(id, price, name, "RUB"); 
	var pack = [{ 
	"currency" : currency, 
	"amount" : cur_amount
	}];
	devtodev.inAppPurchase(name, type, amount, pack); 
	return "Payment " + name + " for " + price + "was successful";
}

function d2d_customEventVoid(name) { 
    // Trigger a custom event with no parameters. 
	// Note: project may have only 300 of those.
    devtodev.customEvent(name); 
	return name + " happened";
}

function d2d_customEventParams(name, param_name, param_type, param_val) { 
    // Trigger a custom event with parameter. 
	// Note: there may be only 50K unique string values for parameters.
	// To-do: support up to 10 parameters. 
	var params = [{ "name" : param_name, "type" : param_type, "value" : param_val }]; 
	devtodev.customEvent(name, params); 
	return name + " happened";
}

function d2d_startProgressionEvent(name, prev_location) { 
    // Start a Progression event. 
	// Progression event - some small level/location user should complete to move on. 
	// Optional: Previous Progression event name 
	// Note: Remember to always end events with ...EndProgressionEvent() functions
	var data = {}; 
	if (prev_location != "" && typeof(prev_location) == "string") data["source"] = prev_location; 
	devtodev.startProgressionEvent(name, data); 
	return "Started " + name;
}

function d2d_quickEndProgressionEvent(name, success) { 
    // Quikcly end Progression event. 
	// devtodev will automatically calculate event duration.
	// success (bool) - whether is event finished with success. 
	devtodev.endProgressionEvent(name, {"success": success}); 
	return name + " is over";
}

function d2d_verboseEndProgressionEvent(name, success, time_spent, got_name, got_amount, spent_name, spent_amount) { 
    // End Progression event. Optional params: 
	// time_spent - leave at 0 to let devtodev handle that 
	// got - currency that player have gained (if any) 
	// spent - currency that player have spent (if any) 
	// To-do: support up to 10 currencies at got and spent
	var params = { "success": success }; 
	if (time_spent > 0) params["duration"] = time_spent; 
	if (spent_name != "") params["spent"] = [{ "currency": spent_name, "amount": spent_amount }]; 
	if (got_name != "") params["earned"] = [{ "currency": got_name, "amount": got_amount}];         
	devtodev.endProgressionEvent(name, params); 
	return name + " is over"; 
}

function d2d_setUserVar(name, value) { 
    // Note: only up to 30 custom variables 
	devtodev.user.set(name, value); 
	return name + " was set to " + value;
}

function d2d_incUserVar(name, by) { 
    // Increment user variable by provided amount 
	devtodev.user.increment(name, by); 
	return name + " was incremented by " + value;
}

function d2d_removeUserVar(name) { devtodev.user.remove(name); return "Removed " + name; }

function d2d_clearUserVars() { devtodev.user.clearUser(); return "Cleared user"; }

function d2d_tutorialStep(step) { 
    // Tell devtodev that user have completed a tutorial step. 
	// Special values: 
	// -2 - tutorial completed 
	// -1 - tutorial have only started (no input from user) 
	//  0 - tutorial skipped 
	devtodev.tutorialCompleted(step); 
	return "Reached tutorial step " + step;
}