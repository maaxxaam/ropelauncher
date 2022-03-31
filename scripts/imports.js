import { Vector2 } from './Vector2.js'

function lerp(a,b,f) { return (b-a)*f+a; };

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

function sprite_collision_points(sprite1_UID, sprite2_UID, precision, runtime, mode) {
	if (mode != "all" && mode != "first") { 
		if (typeof mode == "undefined") mode = "all";
		else throw "Unknown operating mode: can do 'all' or 'first'";
	};
	
	if (typeof sprite1_UID == "number") var sprite1 = runtime.getInstanceByUid(sprite1_UID);
	else var sprite1 = sprite1_UID;
	if (typeof sprite2_UID == "number") var sprite2 = runtime.getInstanceByUid(sprite2_UID);
	else var sprite2 = sprite2_UID;
	
	// Check if we can access needed Sprite functions
	if (typeof(sprite1.getPolyPoint) == "undefined" || typeof(sprite2.getPolyPoint) == "undefined") {
		console.log("Cannot find Sprite collision point: one of the objects doesn't have getPolyPoint() function. Object UIDs: ", sprite1_UID, sprite2_UID);
		throw "Not a Sprite: cannot access getPolyPoint()";
	};
	if (typeof(sprite1.getPolyPointCount) == "undefined" || typeof(sprite2.getPolyPointCount) == "undefined") {
		console.log("Cannot find Sprite collision point: one of the objects doesn't have getPolyPointCount() function. Object UIDs: ", sprite1_UID, sprite2_UID);
		throw "Not a Sprite: cannot access getPolyPointCount()";
	};
	
	if (mode == "all") {
		var results = [];
	}
	
	for (let i = 0; i < sprite1.getPolyPointCount(); i++) {
		const [edge1x, edge1y] = sprite1.getPolyPoint(i);
		const [edge2x, edge2y] = sprite1.getPolyPoint(i + 1);
		const dist = Math.sqrt(((edge2x - edge1x) * (edge2x - edge1x)) + ((edge2y - edge1y) * (edge2y - edge1y)));
		
		for (let progress = 0; progress <= dist; progress += precision) {
			let pointx = lerp(edge1x, edge2x, parseFloat(progress)/dist);
			let pointy = lerp(edge1y, edge2y, parseFloat(progress)/dist);
			if (sprite2.containsPoint(pointx, pointy)) {
				if (mode == "all") results.push([pointx, pointy]);
				else return [pointx, pointy];
			}
		}
	}
	if (mode == "all") return results;
	else return [NaN, NaN];
}

function collision_at_poly(x, y, sprite_UID, runtime) {
	if (typeof sprite_UID == "number") var sprite = runtime.getInstanceByUid(sprite1_UID);
	else var sprite = sprite_UID;
	
	// Check if we can access needed Sprite functions
	if (typeof(sprite.getPolyPoint) == "undefined") {
		console.log("Cannot perform poly check: the object doesn't have getPolyPoint() function. Object UID: ", sprite_UID);
		throw "Not a Sprite: cannot access getPolyPoint()";
	};
	if (typeof(sprite.getPolyPointCount) == "undefined") {
		console.log("Cannot perform poly check: the object doesn't have getPolyPointCount() function. Object UID: ", sprite_UID);
		throw "Not a Sprite: cannot access getPolyPointCount()";
	};
	
	for (let i = 0; i < sprite.getPolyPointCount(); i++) {
		let [polyx, polyy] = sprite.getPolyPoint(i);
		if (x == polyx && polyy == y) return true;
	}
	return false;
}

function point_between_points(x1, y1, x2, y2, x3, y3) {
	// this function is sponsored by StackOverflow
	// https://stackoverflow.com/questions/11907947/how-to-check-if-a-point-lies-on-a-line-between-2-other-points
	let currPoint = new Vector2(x2, y2);
	let point1 = new Vector2(x1, y1);
	let point2 = new Vector2(x3, y3);
	
	let dc = Vector2.subtract(currPoint, point1);
	let dl = Vector2.subtract(point2, point1);
	
	// Check if point lies on a line
	if (Vector2.cross(dc, dl) != 0) return false;
	
	// Check if point lies between two points
	if (Math.abs(dl.x) >= Math.abs(dl.y))
		return dl.x > 0 ? 
			point1.x <= currPoint.x && currPoint.x <= point2.x :
			point2.x <= currPoint.x && currPoint.x <= point1.x;
	else
		return dl.y > 0 ? 
			point1.y <= currPoint.y && currPoint.y <= point2.y :
			point2.y <= currPoint.y && currPoint.y <= point1.y;
}

function get_collisiion_edge(x, y, sprite_UID, runtime) {
	if (typeof sprite_UID == "number") var sprite = runtime.getInstanceByUid(sprite1_UID);
	else var sprite = sprite_UID;
	
	// Check if we can access needed Sprite functions
	if (typeof(sprite.getPolyPoint) == "undefined") {
		console.log("Cannot find egde: the object doesn't have getPolyPoint() function. Object UID: ", sprite_UID);
		throw "Not a Sprite: cannot access getPolyPoint()";
	};
	if (typeof(sprite.getPolyPointCount) == "undefined") {
		console.log("Cannot find edge: the object doesn't have getPolyPointCount() function. Object UID: ", sprite_UID);
		throw "Not a Sprite: cannot access getPolyPointCount()";
	};
	
	for (let i = 0; i < sprite.getPolyPointCount(); i++) {
		const [edge1x, edge1y] = sprite.getPolyPoint(i);
		const [edge2x, edge2y] = sprite.getPolyPoint(i + 1);
		if (point_between_points(edge1x, edge1y, x, y, edge2x, edge2y)) return i;
	}
	return 0;
}

export function car_collision_resolution(car1_UID, car2_UID, runtime) {
	if (typeof car1_UID == "number") var car1 = runtime.getInstanceByUid(car1_UID);
	else var car1 = car1_UID;
	if (typeof car2_UID == "number") var car2 = runtime.getInstanceByUid(car2_UID);
	else var car2 = car2_UID;
	console.log(runtime.gameTime);
	let car1_col = car1.getChildAt(0);
	let car2_col = car2.getChildAt(0);
	console.log(car1_col, car2_col);
	
	// find correct edge to base a normal off
	let [carx, cary] = sprite_collision_points(car1_col, car2_col, 5, runtime, "first");
	let isFirstCarPoint = collision_at_poly(carx, cary, car1_col, runtime);
	if (isFirstCarPoint) {
		[carx, cary] = sprite_collision_points(car2_col, car1_col, 5, runtime, "first");
		let edge = get_collisiion_edge(carx, cary, car2_col, runtime);
		console.log(edge);
		var distance_tangent = Vector2.normalize(new Vector2(car2_col.getPolyPointX(edge+1) - car2_col.getPolyPointX(edge), car2_col.getPolyPointY(edge+1) - car2_col.getPolyPointY(edge)));
	}
	else {
		let edge = get_collisiion_edge(carx, cary, car1_col, runtime);
		console.log(edge);
		var distance_tangent = Vector2.normalize(new Vector2(car1_col.getPolyPointX(edge+1) - car1_col.getPolyPointX(edge), car1_col.getPolyPointY(edge+1) - car1_col.getPolyPointY(edge)));
	}
	
	//console.log("Distance tangent:", distance_tangent.x, distance_tangent.y);
	const distance_vector = Vector2.rotateDegree(distance_tangent, 90);
	//console.log("Distance vector:", distance_vector.x, distance_vector.y);
	
	const velocity1 = Vector2(car1.behaviors.Car.vectorX, car1.behaviors.Car.vectorY);
	console.log("Velocity1:", velocity1.x, velocity1.y, car1.behaviors.Car.speed);
	const velocity2 = Vector2(car2.behaviors.Car.vectorX, car2.behaviors.Car.vectorY);
	console.log("Velocity2:", velocity2.x, velocity2.y, car2.behaviors.Car.speed);
	
	let dist_vel1 = Vector2.dot(velocity1, distance_vector);
	//console.log("Distance projection 1:", dist_vel1);
	let dist_vel2 = Vector2.dot(velocity2, distance_vector);
	//console.log("Distance projection 2:", dist_vel2);
	
	let tan_vel1 = Vector2.dot(velocity1, distance_tangent);
	//console.log("Tangent projection 1:", tan_vel1);
	let tan_vel2 = Vector2.dot(velocity2, distance_tangent);
	//console.log("Tangent projection 2:", tan_vel2);
	
	let mass1 = car1.instVars.Mass;
	let mass2 = car2.instVars.Mass;
	
	const eps = 1.25; // > 1 - more energy, < 1 - less energy 
	let resolved_vel1 = (mass2 * dist_vel2 * (eps + 1) + dist_vel1 * (mass1 - eps * mass2))/(mass1 + mass2);
	let resolved_vel2 = (mass1 * dist_vel1 * (eps + 1) - dist_vel2 * (mass1 - eps * mass2))/(mass1 + mass2);

	//console.log("Resolved speed 1:", resolved_vel1);
	//console.log("Resolved speed 2:", resolved_vel2);
	
	let vx1 = resolved_vel1 * distance_vector.x + tan_vel1 * distance_tangent.x;
	let vy1 = resolved_vel1 * distance_vector.y + tan_vel1 * distance_tangent.y;
	console.log("Final velocity 1:", vx1, vy1);
	let vx2 = resolved_vel2 * distance_vector.x + tan_vel2 * distance_tangent.x;
	let vy2 = resolved_vel2 * distance_vector.y + tan_vel2 * distance_tangent.y;
	console.log("Final velocity 2:", vx2, vy2);
	//debugger;
	return [vx1, vy1, vx2, vy2];
}