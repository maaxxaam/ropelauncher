import { Vector2 } from './Vector2.js'

export var Vector = Vector2;

function lerp(a,b,f) { return (b-a)*f+a; };

export function clamp(low, a, high) { return a < low ? low : (a > high ? high : a); };

export function tile_degrees(integer) {
	let horizontal = -((integer & ITilemapInstance.TILE_FLIPPED_HORIZONTAL) >> 31);
	let vertical = (integer & ITilemapInstance.TILE_FLIPPED_VERTICAL) >> 30;
	let diagonal = (integer & ITilemapInstance.TILE_FLIPPED_DIAGONAL) >> 29;
	if (horizontal & diagonal) return 90;
	else if (horizontal & vertical) return 180;
	else if (vertical & diagonal) return 270;
	else return 0;
};

function Point(x, y) {
	return {x:x, y:y}
}

export function layer_to_layer_px(x, y, layer_from, layer_to) { // assuming both point are visible, i guess
let [cssx, cssy] = layer_from.layerToCssPx(x, y);
let [fx, fy] = layer_to.cssPxToLayer(cssx, cssy);
return [fx, fy];
}

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

function project_point_onto_vector(vector, point) {
	const dot_over_len2 = Vector2.dot(vector, point) / Vector2.dot(vector, vector);
	let res_point = Vector2.multiply(vector, dot_over_len2);
	res_point.dot = Vector2.dot(vector, point);
	res_point.len_sqr = Math.abs(res_point.dot);
	return res_point;
}

function project_line_onto_vector(vector, point1, point2) {
	return [project_point_onto_vector(vector, point1), project_point_onto_vector(vector, point2)];
}

function line_intersection_point(edge1, edge2) {
	let edge1vec = Vector2.subtract(edge1[0], edge1[1]);
	let edge2vec = Vector2.subtract(edge2[0], edge2[1]);
	let edgeCross = Vector2.cross(edge1vec, edge2vec);
	let edge1cross = Vector2.cross(edge1[0], edge1[1]);
	let edge2cross = Vector2.cross(edge2[0], edge2[1]);
	let fin = Vector2.subtract(Vector2.multiply(edge2vec, edge1cross), Vector2.multiply(edge1vec, edge2cross));
	return Vector2.divide(fin, edgeCross);
}

function vertices_clockwise_sort(vertices) {
	// calc centroid
	let centroid = Point(0, 0);
	for (let point of vertices) Vector2.add(centroid, point);
	centroid = Vector2.divide(centroid, vertices.length);
	
	return vertices.sort(function(a, b) {
    	return Math.atan2(a.y - centroid.y, a.x - centroid.x)
        	 - Math.atan2(b.y - centroid.y, b.x - centroid.x);
	});
}

function point_right_side(edge, point) {
	let edgeVec = Vector2.subtract(edge[1], edge[0]);
	let edgeRNormal = Vector2(edgeVec.y, -edgeVec.x);
	let pointVec = Vector2.subtract(point, edge[0]);
	return Math.sign(Vector2.cross(edgeVec, pointVec)) == Math.sign(Vector2.cross(edgeVec, edgeRNormal));
}

function simple_sutherland_hodgman_clipping(edgeInc, edgeClip, del) {
	//debugger;
	let res = [];
	if (point_right_side(edgeClip, edgeInc[1])) {
		if (!point_right_side(edgeClip, edgeInc[0])) {
			if (!del) res.push(line_intersection_point(edgeInc, edgeClip));
		} else {
			if (!del) res.push(edgeInc[0])
		}
		res.push(edgeInc[1]);
	} else if (point_right_side(edgeClip, edgeInc[0])) {
		res.push(edgeInc[0]);
		if (!del) res.push(line_intersection_point(edgeInc, edgeClip));
	} else {
		//debugger;
		//console.log("Nothing here");
		return simple_sutherland_hodgman_clipping(edgeInc, edgeClip.reverse(), del);
		//res = edgeInc;
	}
	
	return res;
}

function cannot_get_poly(sprite) {
	return (typeof(sprite.getPolyPoint) == "undefined" || typeof(sprite.getPolyPointCount) == "undefined")
}

function get_polygon_normals(sprite) {
	// Check if we can access needed Sprite functions
	if (cannot_get_poly(sprite)) throw "Not a Sprite: cannot access collision polygon";
	var normals = [];
	
	for (let i = 0; i < sprite.getPolyPointCount(); i++) {
		let [edge1, edge2] = [Point(0, 0), Point(0,0)];
		[edge1.x, edge1.y] = sprite.getPolyPoint(i);
		[edge2.x, edge2.y] = sprite.getPolyPoint(i + 1);
		let perpendicular = Vector2.normalize(new Vector2(edge2.y - edge1.y, edge1.x - edge2.x));
		normals.push(perpendicular);
	}
	
	return normals;
}

function project_collision_onto_vector(sprite, vector) {
	let point = Point(sprite.getPolyPointX(0), sprite.getPolyPointY(0));
	
	let proj = [new Point(Infinity, Infinity), new Point(-Infinity, -Infinity)];
	proj[0] = project_point_onto_vector(vector, point);
	proj[1] = project_point_onto_vector(vector, point);
	for (let i = 1; i < sprite.getPolyPointCount(); i++) {
		[point.x, point.y] = sprite.getPolyPoint(i);
		const projected = project_point_onto_vector(vector, point);
		if (proj[0].dot > projected.dot) proj[0] = projected;
		if (proj[1].dot < projected.dot) proj[1] = projected;
	}
	return proj;
}

function brings_closer(sprite1, sprite2, normal, from_1) {
	let before = Vector2.distance(sprite1, sprite2);
	let ops = [Vector2.add, Vector2.subtract];
	if (!from_1) ops = ops.reverse();
	let a1 = ops[0](sprite1, normal);
	let a2 = ops[1](sprite2, normal);
	let after = Vector2.distance(a1, a2);
	return before > after;
}

export function close_projection_points(sprite1, sprite2, normal) {
	let proj1 = project_collision_onto_vector(sprite1, normal);
	// find projection of sprite2 onto normal
	let proj2 = project_collision_onto_vector(sprite2, normal);
	// see if they overlap
	// !IMPORTANT! The following math works assuming all coordinates have the same sign
	let over1 = proj1[0].dot > proj2[0].dot ? proj1[0] : proj2[0];
	let over2 = proj1[1].dot < proj2[1].dot ? proj1[1] : proj2[1];
	return [over1, over2];
}

export function SAT_collision(sprite1, sprite2) {	
	let col_normal = Vector2(0, 0);
	let overlap = Vector2(Infinity, Infinity);
	overlap.len_sqr = Infinity;
	
	// Check if we can access needed Sprite functions
	if (cannot_get_poly(sprite1) || cannot_get_poly(sprite2)) throw "Not a Sprite: cannot access collision polygon";
	
	var normals = get_polygon_normals(sprite1).concat(get_polygon_normals(sprite2));
	const half = sprite1.getPolyPointCount() - 1; //normal amount = edges = points - 1
	let obj = sprite1;
	
	for (let i = 0; i < normals.length; i++) {
		const normal = normals[i];
		// see if they overlap
		// !IMPORTANT! The following math works assuming all coordinates have the same sign
		let [over1, over2] = close_projection_points(sprite1, sprite2, normal);
		if (over1.dot > over2.dot) { // no overlap
			return {collided: false};
		} else {
			let overVec = Vector2.subtract(over2, over1);
			overVec.len_sqr = Vector2.dot(overVec, overVec);
			if ((overVec.len_sqr < overlap.len_sqr) || (overVec.len_sqr == overlap.len_sqr && (brings_closer(sprite1, sprite2, normal, i < half)))) {
				overlap = overVec;
				col_normal = normal;
				obj = i < half ? sprite1 : sprite2;
			}
		}
	}
	return {collided: true, normal: col_normal, overlap: overlap, obj: obj};
}

export function furthest_point_from_vector(sprite, vector) {
	let farthest = new Point(-Infinity, -Infinity);
	farthest.dot = -Infinity;
	for (let i = 0; i < sprite.getPolyPointCount(); i++) {
		let point = new Point(0, 0);
		[point.x, point.y] = sprite.getPolyPoint(i);
		
		let dot = Vector2.dot(point, vector);
		//debugger;
		if (dot > farthest.dot) { 
			farthest = point;
			farthest.dot = dot;
			farthest.index = i;
		}
	}
	return farthest;
}

function orthogonal_neighbour_edge(sprite, point, index, normal) {
	let res = new Point(0, 0);
	let edge1 = new Point(0, 0);
	let edge2 = new Point(0, 0);
	edge1.index = index - 1;
	if (index == 0) edge1.index += sprite.getPolyPointCount();
	[edge1.x, edge1.y] = sprite.getPolyPoint(edge1.index);
	[edge2.x, edge2.y] = sprite.getPolyPoint(index + 1);
	edge2.index = index + 1;
	// choose the one most orthogonal based on dot product (maybe incorrect but works fine)
	const n1 = Vector2.normalize(Vector2.subtract(point, edge1));
	const n2 = Vector2.normalize(Vector2.subtract(edge2, point));
	edge1.dot = Vector2.dot(n1, normal);
	edge2.dot = Vector2.dot(n2, normal);
	if (Math.abs(edge1.dot) < Math.abs(edge2.dot)) {
		point.dot = edge1.dot;
		return [edge1, point];
	} else {
		point.dot = edge2.dot;
		return [point, edge2];
	}
}

export function get_collision_point(sprite1, sprite2, collision_data) {
	// Check if we can access needed Sprite functions
	if (cannot_get_poly(sprite1) || cannot_get_poly(sprite2)) throw "Not a Sprite: cannot access collision polygon";
	// get colliding edges
	
	if (collision_data.obj === sprite1) {
		var point10 = furthest_point_from_vector(sprite1, collision_data.normal);
		var point20 = furthest_point_from_vector(sprite2, Vector2.inverse(collision_data.normal));
	} else {
		var point10 = furthest_point_from_vector(sprite1, Vector2.inverse(collision_data.normal));
		var point20 = furthest_point_from_vector(sprite2, collision_data.normal);
	}
	
	//var point10 = furthest_point_from_vector(sprite1, collision_data.normal);
	//var point20 = furthest_point_from_vector(sprite2, collision_data.normal);
	let point11 = Point(0, 0);
	[point10, point11] = orthogonal_neighbour_edge(sprite1, point10, point10.index, collision_data.normal);
	let point21 = Point(0, 0);
	[point20, point21] = orthogonal_neighbour_edge(sprite2, point20, point20.index, collision_data.normal);
	
	// choose reference and incident faces
	// choose the one most orthogonal based on dot product (maybe incorrect but works fine)
	if (Math.abs(point11.dot) < Math.abs(point21.dot)) {
		var ref_sprite = sprite1;
		var inc_sprite = sprite2;
		var ref = [point10, point11];
		var inc = [point20, point21];
	} else {
		var inc_sprite = sprite1;
		var ref_sprite = sprite2;
		var inc = [point10, point11];
		var ref = [point20, point21];
	}
	//debugger;
	//const inter = line_intersection_point(ref, inc);
	//const inter_on_lines = point_between_points(ref[0].x, ref[0].y, inter.x, inter.y, ref[1].x, ref[1].y) && point_between_points(inc[0].x, inc[0].y, inter.x, inter.y, inc[1].x, inc[1].y)
	// adjacent face clipping
	
	let point00 = Vector2(0, 0);
	let point30 = Vector2(0, 0);
	[point30.x, point30.y] =  ref_sprite.getPolyPoint((ref[0].index + 2) % ref_sprite.getPolyPointCount());
	[point00.x, point00.y] =  ref_sprite.getPolyPoint(ref[0].index == 0 ? ref_sprite.getPolyPointCount() - 1 : ref[0].index - 1);
	let inter = simple_sutherland_hodgman_clipping(inc, [point00, ref[0]]);
	inter = simple_sutherland_hodgman_clipping(inter, [point30, ref[1]]);
	let result = simple_sutherland_hodgman_clipping(inter, [ref[0], ref[1]], true)[0];
	result.ref = ref;
	result.inc = inc;
	result.p0 = point00;
	result.p3 = point30;
	result.cut = inter;
	// try simple intersection instead
	//let result = line_intersection_point(inc, ref);
	
	return result;
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
	let cross = Vector2.cross(dc, dl);
	if (cross >= 1e-10 && cross <= -1e-10) return false; // allow floating-point errors
	
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

export function car_collision_resolution(car1, car2, collision_data, collision_point) {
	let cars = [car1, car2];
	let [vels, avs, invmasses, astarts, avecs] = [[], [], [], [], []];
	
	for (let car of cars) { 
		vels.push(Vector2(car.behaviors.Car.vectorX, car.behaviors.Car.vectorY));
		avecs.push(Vector2.subtract(collision_point, Vector2(car.x, car.y)));
		invmasses.push(1 / car.instVars.Mass);
		astarts.push(car.behaviors.Car.steering ? car.behaviors.Car.steerSpeed : 0)
	}
	
	const normal = collision_data.normal;
	const rel_vel = Vector2.subtract(vels[0], vels[1]);
	const I = 1000000;
	const eps = 1.1; // > 1 - more energy, < 1 - less energy 
	
	let up = Vector2.dot(Vector2.multiply(rel_vel, -(1 + eps)), normal);
	let down = Vector2.dot(normal, Vector2.multiply(normal, (invmasses[0] + invmasses[1])));
	for (let avec of avecs) down += Math.pow(Vector2.dot(avec, normal), 2)/I;
	let j = up / down;
	
	let fin_vel1 = Vector2.add(vels[0], Vector2.multiply(normal, j*invmasses[0]));
	let fin_vel2 = Vector2.subtract(vels[1], Vector2.multiply(normal, j*invmasses[1]));
	
	for (let i = 0; i < 2; i++) avs.push(astarts[i] + Vector2.dot(avecs[i], Vector2.multiply(normal, j)) / I);

	return [fin_vel1.x, fin_vel1.y, avs[0], fin_vel2.x, fin_vel2.y, avs[1]];
}