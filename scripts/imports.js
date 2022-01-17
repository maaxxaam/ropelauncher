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