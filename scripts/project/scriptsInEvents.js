function test_tile_for_corner(tile) {
	var no_extra_bits = (tile & ~151) == 0;
	var has_148 = (tile & 148) == 148;
	var has_130 = (tile & 130) == 130;
	return no_extra_bits && (has_130 || has_148);
}

function map_corners_to_pos(tile) {
	var res = 0;
	if ((tile & 130) == 130) {
		res = tile & 1;
	} else {
		res = (tile & 1) | 2;
	}
	return res;
}

function map_corners_to_clock(tile) {
	var res = 0;
	if ((tile & 130) == 130) {
		res = tile & 1;
	} else {
		res = ((tile & 1) ^ 1) | 2;
	}
	return res;
}

function map_corners_to_circle(tile) {
	var res = 0;
	if ((tile & 130) == 130) {
		res = ((tile & 1) ^ 1) + 1;
	} else {
		res = (5 - (tile & 7)) * 3;
	}
	return res;
}


const scriptsInEvents = {

		async Gamesheet_Event23_Act2(runtime, localVars)
		{
			localVars.is_corner = test_tile_for_corner(localVars.tile);
		},

		async Gamesheet_Event24_Act3(runtime, localVars)
		{
			localVars.clock_id = map_corners_to_clock(localVars.tile);
			localVars.pos_id = map_corners_to_pos(localVars.tile);
			localVars.circle_id = map_corners_to_circle(localVars.tile);
			//alert(localVars.tile + " " + localVars.clock_id + " " + localVars.pos_id);
		},

		async Devtodev_Event2(runtime, localVars)
		{
			runtime.setReturnValue(initDevtodev(localVars.platformType, localVars.playerID))
		},

		async Devtodev_Event4(runtime, localVars)
		{
			runtime.setReturnValue(d2d_setLevel(localVars.Level))
		},

		async Devtodev_Event6(runtime, localVars)
		{
			runtime.setReturnValue(d2d_lvlUp(localVars.Level))
		},

		async Devtodev_Event8(runtime, localVars)
		{
			runtime.setReturnValue(d2d_onPayment(localVars.id, localVars.name, localVars.price, localVars.type, localVars.amount, localVars.currency, localVars.cur_amount))
		},

		async Devtodev_Event10(runtime, localVars)
		{
			runtime.setReturnValue(d2d_startProgressionEvent(localVars.name))
		},

		async Devtodev_Event12(runtime, localVars)
		{
			var succ = false;
			if (localVars.success > 0) succ = true;
			console.log("Succ is " + succ);
			runtime.setReturnValue(d2d_quickEndProgressionEvent(localVars.name, succ));
		},

		async Devtodev_Event14(runtime, localVars)
		{
			runtime.setReturnValue(d2d_tutorialStep(localVars.step))
		}

};

self.C3.ScriptsInEvents = scriptsInEvents;

