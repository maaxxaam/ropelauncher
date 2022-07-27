import { Vector2 } from './Vector2.js'
import * as Editor from './bezier.js'

export var RoadEditor = new Editor.CurveEditor();
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
	return new Vector(x, y);
}

export function layer_to_layer_px(x, y, layer_from, layer_to) { // assuming both point are visible, i guess
let [cssx, cssy] = layer_from.layerToCssPx(x, y);
let [fx, fy] = layer_to.cssPxToLayer(cssx, cssy);
return [fx, fy];
}

function project_point_onto_vector(vector, point) {
	const dot_over_len2 = vector.dot(point) / vector.dot(vector);
	let res_point = vector.multiply(dot_over_len2);
	res_point.pre_dot = vector.dot(point);
	res_point.len_sqr = Math.abs(res_point.pre_dot);
	return res_point;
}

function project_line_onto_vector(vector, point1, point2) {
	return [project_point_onto_vector(vector, point1), project_point_onto_vector(vector, point2)];
}

export function distance_line_point(edge1, edge2, point){
	const edge_vector = edge2.subtract(edge1);
	const other_vector = point.subtract(edge1);
	return edge_vector.cross(other_vector) / edge2.distance(edge1);
}

function line_intersection_point(edge1, edge2) {
	let edge1vec = edge1[0].subtract(edge1[1]);
	let edge2vec = edge2[0].subtract(edge2[1]);
	let edgeCross = edge1vec.cross(edge2vec);
	let edge1cross = edge1[0].cross(edge1[1]);
	let edge2cross = edge2[0].cross(edge2[1]);
	let result = edge2vec.multiply(edge1cross).subtract(edge1vec.multiply(edge2cross));
	return result.divide(edgeCross);
}

function vertices_clockwise_sort(vertices) {
	// calc centroid
	let centroid = Point(0, 0);
	for (let point of vertices) centroid.add(point);
	centroid = centroid.divide(vertices.length);
	
	return vertices.sort((a, b) => {
    	return Math.atan2(a.y - centroid.y, a.x - centroid.x)
        	 - Math.atan2(b.y - centroid.y, b.x - centroid.x);
	});
}

function point_right_side(edge, point) {
	let edgeVec = edge[1].subtract(edge[0]);
	let edgeRNormal = new Vector(edgeVec.y, -edgeVec.x);
	let pointVec = point.subtract(edge[0]);
	return Math.sign(edgeVec.cross(pointVec)) == Math.sign(edgeVec.cross(edgeRNormal));
}

function simple_sutherland_hodgman_clipping(edgeInc, edgeClip, del) {
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
		return simple_sutherland_hodgman_clipping(edgeInc, edgeClip.reverse(), del);
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
		let normal = new Vector(edge2.y - edge1.y, edge1.x - edge2.x).normalize();
		normals.push(normal);
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
		if (proj[0].pre_dot > projected.pre_dot) proj[0] = projected;
		if (proj[1].pre_dot < projected.pre_dot) proj[1] = projected;
	}
	return proj;
}

function brings_closer(sprite1, sprite2, normal, from_1) {
	let s1 = new Vector(sprite1.x, sprite1.y);
	let s2 = new Vector(sprite2.x, sprite2.y);
	var between = s1.subtract(s2);
	if (from_1) between = between.inverse();
	return between.angleUnsigned(normal) < 90;
}

export function close_projection_points(sprite1, sprite2, normal) {
	let proj1 = project_collision_onto_vector(sprite1, normal);
	// find projection of sprite2 onto normal
	let proj2 = project_collision_onto_vector(sprite2, normal);
	// see if they overlap
	// !IMPORTANT! The following math works assuming all coordinates have the same sign
	let over1 = proj1[0].pre_dot > proj2[0].pre_dot ? proj1[0] : proj2[0];
	let over2 = proj1[1].pre_dot < proj2[1].pre_dot ? proj1[1] : proj2[1];
	return [over1, over2];
}

export function SAT_collision(sprite1, sprite2) {
	let col_normal = new Vector(0, 0);
	let overlap = new Vector(Infinity, Infinity);
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
		if (over1.pre_dot > over2.pre_dot) { // no overlap
			return {collided: false};
		} else {
			let overVec = over2.subtract(over1);
			overVec.len_sqr = overVec.dot(overVec);
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
	farthest.pre_dot = -Infinity;
	for (let i = 0; i < sprite.getPolyPointCount(); i++) {
		let point = new Point(0, 0);
		[point.x, point.y] = sprite.getPolyPoint(i);
		
		let dot = point.dot(vector);
		if (dot > farthest.pre_dot) { 
			farthest = point;
			farthest.pre_dot = dot;
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
	const n1 = point.subtract(edge1).normalize();
	const n2 = edge2.subtract(point).normalize();
	edge1.pre_dot = n1.dot(normal);
	edge2.pre_dot = n2.dot(normal);
	if (Math.abs(edge1.pre_dot) < Math.abs(edge2.pre_dot)) {
		point.pre_dot = edge1.pre_dot;
		return [edge1, point];
	} else {
		point.pre_dot = edge2.pre_dot;
		return [point, edge2];
	}
}

export function get_collision_point(sprite1, sprite2, collision_data) {
	// Check if we can access needed Sprite functions
	if (cannot_get_poly(sprite1) || cannot_get_poly(sprite2)) throw "Not a Sprite: cannot access collision polygon";
	// get colliding edges
	
	if (collision_data.obj === sprite1) {
		var point10 = furthest_point_from_vector(sprite1, collision_data.normal);
		var point20 = furthest_point_from_vector(sprite2, collision_data.normal.inverse());
	} else {
		var point10 = furthest_point_from_vector(sprite1, collision_data.normal.inverse());
		var point20 = furthest_point_from_vector(sprite2, collision_data.normal);
	}
	
	let point11 = Point(0, 0);
	[point10, point11] = orthogonal_neighbour_edge(sprite1, point10, point10.index, collision_data.normal);
	let point21 = Point(0, 0);
	[point20, point21] = orthogonal_neighbour_edge(sprite2, point20, point20.index, collision_data.normal);
	
	// choose reference and incident faces
	// choose the one most orthogonal based on dot product (maybe incorrect but works fine)
	if (Math.abs(point11.pre_dot) < Math.abs(point21.pre_dot)) {
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
	// adjacent face clipping
	
	let point00 = new Vector(0, 0);
	let point30 = new Vector(0, 0);
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
	let currPoint = new Point(x2, y2);
	let point1 = new Point(x1, y1);
	let point2 = new Point(x3, y3);
	
	let dc = currPoint.subtract(point1);
	let dl = point2.subtract(point1);
	
	// Check if point lies on a line
	let cross = dc.cross(dl);
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
		vels.push(new Vector(car.behaviors.Car.vectorX, car.behaviors.Car.vectorY));
		avecs.push(collision_point.subtract(new Vector(car.x, car.y)));
		invmasses.push(1 / car.instVars.Mass);
		astarts.push(car.behaviors.Car.steering ? car.behaviors.Car.steerSpeed : 0)
	}
	
	const normal = collision_data.normal;
	const rel_vel = vels[0].subtract(vels[1]);
	const I = 1000000;
	const eps = 1.1; // > 1 - more energy, < 1 - less energy 
	
	let up = rel_vel.multiply(-(1 + eps)).dot(normal);
	let down = normal.dot(normal.multiply(invmasses[0] + invmasses[1]));
	for (let avec of avecs) down += Math.pow(avec.dot(normal), 2) / I;
	let j = up / down;
	
	let fin_vel1 = vels[0].add(normal.multiply(j * invmasses[0]));
	let fin_vel2 = vels[1].subtract(normal.multiply(j * invmasses[1]));
	
	for (let i = 0; i < 2; i++) avs.push(astarts[i] + avecs[i].dot(normal.multiply(j)) / I);

	return [fin_vel1.x, fin_vel1.y, avs[0], fin_vel2.x, fin_vel2.y, avs[1]];
}


const scriptsInEvents = {

		async Edsheet_Event1_Act3(runtime, localVars)
		{
			RoadEditor = new Editor.CurveEditor();
		},

		async Edsheet_Event3_Act2(runtime, localVars)
		{
			let array = runtime.objects.RoadPoints.getFirstInstance();
			RoadEditor.loadFromCArray(array);
			RoadEditor.hideFullEditor();
		},

		async Edsheet_Event4(runtime, localVars)
		{
			let looped = runtime.objects.loop.getFirstInstance();
			looped.isChecked = RoadEditor.track.loop;
		},

		async Edsheet_Event35_Act3(runtime, localVars)
		{
			RoadEditor.showFullEditor();
		},

		async Edsheet_Event37_Act2(runtime, localVars)
		{
			RoadEditor.hideFullEditor();
		},

		async Edsheet_Event87_Act1(runtime, localVars)
		{
			Editor.RoadEditor.cleanSlate();
			console.log(runtime.objects.meshedRoad.getAllInstances().length);
		},

		async Edsheet_Event114(runtime, localVars)
		{
			let edited = runtime.getInstanceByUid(runtime.globalVars.EditUID);
			let prev = {zIndex: -Infinity, isStub: true};
			for (let element of runtime.objects.MapElement.getAllInstances()) {
				if (edited.testOverlap(element) && edited.zIndex > element.zIndex && element.zIndex > prev.zIndex) {
					prev = element;
				}
			};
			if (!prev.isStub){
				edited.moveAdjacentToInstance(prev, false);
			}
		},

		async Edsheet_Event116(runtime, localVars)
		{
			let edited = runtime.getInstanceByUid(runtime.globalVars.EditUID);
			let next = {zIndex: Infinity, isStub: true};
			for (let element of runtime.objects.MapElement.getAllInstances()) {
				if (edited.testOverlap(element) && edited.zIndex < element.zIndex && element.zIndex < next.zIndex) {
					next = element;
				}
			};
			if (!next.isStub) {
				edited.moveAdjacentToInstance(next, true);
			}
		},

		async Edsheet_Event123_Act1(runtime, localVars)
		{
			let control = runtime.objects.control_handle.getFirstPickedInstance();
			let index = control.instVars.point;
			let right = control.instVars.right;
			let position = new Vector(control.x, control.y);
			console.log(index, right);
			RoadEditor.moveControl(index, right, position);
		},

		async Edsheet_Event130_Act1(runtime, localVars)
		{
			let control = runtime.objects.anchor_handle.getFirstPickedInstance();
			let index = control.instVars.point;
			let position = new Vector(control.x, control.y);
			RoadEditor.moveAnchor(index, position);
		},

		async Edsheet_Event135_Act3(runtime, localVars)
		{
			let handle = runtime.objects.anchor_handle.getFirstPickedInstance();
			let index = handle.instVars.point;
			RoadEditor.removePoint(index);
		},

		async Edsheet_Event139_Act1(runtime, localVars)
		{
			RoadEditor.newPoint(runtime, new Vector(localVars.TouchX, localVars.TouchY));
			RoadEditor.showFullEditor();
		},

		async Edsheet_Event142_Act1(runtime, localVars)
		{
			let road = runtime.objects.meshedRoad.getFirstPickedInstance();
			let anchor = road.getParent();
			localVars.new_index = anchor.instVars.point + 1;
			RoadEditor.insertPoint(runtime, anchor.instVars.point, new Vector(localVars.TouchX, localVars.TouchY));
			RoadEditor.showFullEditor();
		},

		async Edsheet_Event150_Act2(runtime, localVars)
		{
			let check = runtime.objects.loop.getFirstPickedInstance();
			RoadEditor.loop(runtime, check.isChecked);
			RoadEditor.showFullEditor();
		},

		async Edsheet_Event167_Act1(runtime, localVars)
		{
			let changes = runtime.objects.changes_buffer.getFirstInstance();
			const action = changes.instVars.last_action;
			if (RoadEditor.track.loop) {
				let point0 = RoadEditor.track.points[0];
				let point_last = RoadEditor.track.points[RoadEditor.track.pointsEnd];
				changes.getAt(point0.control1.x, action, 2);
				changes.getAt(point0.control1.y, action, 3);
				changes.getAt(point_last.control2.x, action, 4);
				changes.getAt(point_last.control2.y, action, 5);
			}
		},

		async Edsheet_Event173_Act1(runtime, localVars)
		{
			let changes = runtime.objects.changes_buffer.getFirstInstance();
			const entry = changes.instVars.current_action;
			RoadEditor.removePoint(changes.getAt(entry, 2));
		},

		async Edsheet_Event174_Act1(runtime, localVars)
		{
			let changes = runtime.objects.changes_buffer.getFirstInstance();
			const entry = changes.instVars.current_action;
			RoadEditor.moveAnchor(changes.getAt(entry, 2), new Vector(changes.getAt(entry, 3), changes.getAt(entry, 4)));
			if (changes.getAt(entry, 5) != 0) {
				RoadEditor.moveControl(changes.getAt(entry, 2), false, new Vector(changes.getAt(entry, 5), changes.getAt(entry, 6)));
			}
			if (changes.getAt(entry, 7) != 0) {
				RoadEditor.moveControl(changes.getAt(entry, 2), true, new Vector(changes.getAt(entry, 7), changes.getAt(entry, 8)));
			}
			let anchor = RoadEditor.anchors[changes.getAt(entry, 2)];
			let av = new Vector(anchor.x, anchor.y);
			for (let control of anchor.children()) {
				for (let line of control.children()) {
					let lv = new Vector(line.x, line.y);
					if (av.subtract(lv).normalize().equalTo(new Vector(-1, 0))) line.angleDegrees = 180;
					else line.angleDegrees = - av.subtract(lv).angleSigned(new Vector(1, 0));
					line.width = av.distance(lv);
				}
			}
		},

		async Edsheet_Event175_Act1(runtime, localVars)
		{
			let changes = runtime.objects.changes_buffer.getFirstInstance();
			const entry = changes.instVars.current_action;
			RoadEditor.removePoint(changes.getAt(entry, 2));
		},

		async Edsheet_Event176_Act1(runtime, localVars)
		{
			let changes = runtime.objects.changes_buffer.getFirstInstance();
			const entry = changes.instVars.current_action;
			RoadEditor.insertPoint(runtime, changes.getAt(entry, 2) - 1, new Vector(changes.getAt(entry, 3), changes.getAt(entry, 4)));
			RoadEditor.showFullEditor();
			if (changes.getAt(entry, 5) != 0) {
				RoadEditor.moveControl(changes.getAt(entry, 2), false, new Vector(changes.getAt(entry, 5), changes.getAt(entry, 6)));
			}
			if (changes.getAt(entry, 7) != 0) {
				RoadEditor.moveControl(changes.getAt(entry, 2), true, new Vector(changes.getAt(entry, 7), changes.getAt(entry, 8)));
			}
		},

		async Edsheet_Event177_Act1(runtime, localVars)
		{
			let changes = runtime.objects.changes_buffer.getFirstInstance();
			const entry = changes.instVars.current_action;
			RoadEditor.loop(runtime, !RoadEditor.track.loop);
			if (RoadEditor.track.loop) {
				if (changes.getAt(entry, 2) != 0) {
					RoadEditor.moveControl(0, false, new Vector(changes.getAt(entry, 2), changes.getAt(entry, 3)));
				}
				if (changes.getAt(entry, 4) != 0) {
					RoadEditor.moveControl(RoadEditor.track.pointsEnd, true, new Vector(changes.getAt(entry, 4), changes.getAt(entry, 5)));
				}
			}
			if (runtime.globalVars.EdState != runtime.globalVars.EDITOR_READY) RoadEditor.showFullEditor();
			else RoadEditor.hideFullEditor();
		},

		async Edsheet_Event184_Act1(runtime, localVars)
		{
			let changes = runtime.objects.changes_buffer.getFirstInstance();
			const entry = changes.instVars.current_action;
			RoadEditor.insertPoint(runtime, changes.getAt(entry, 2) - 1, new Vector(changes.getAt(entry, 3), changes.getAt(entry, 4)));
			RoadEditor.showFullEditor();
			if (changes.getAt(entry, 5) != 0) {
				RoadEditor.moveControl(changes.getAt(entry, 2), false, new Vector(changes.getAt(entry, 5), changes.getAt(entry, 6)));
			}
			if (changes.getAt(entry, 7) != 0) {
				RoadEditor.moveControl(changes.getAt(entry, 2), true, new Vector(changes.getAt(entry, 7), changes.getAt(entry, 8)));
			}
		},

		async Edsheet_Event185_Act1(runtime, localVars)
		{
			let changes = runtime.objects.changes_buffer.getFirstInstance();
			const entry = changes.instVars.current_action;
			RoadEditor.moveAnchor(changes.getAt(entry, 2), new Vector(changes.getAt(entry, 9), changes.getAt(entry, 10)));
			if (changes.getAt(entry, 11) != 0) {
				RoadEditor.moveControl(changes.getAt(entry, 2), false, new Vector(changes.getAt(entry, 11), changes.getAt(entry, 12)));
			}
			if (changes.getAt(entry, 13) != 0) {
				RoadEditor.moveControl(changes.getAt(entry, 2), true, new Vector(changes.getAt(entry, 13), changes.getAt(entry, 14)));
			}
			let anchor = RoadEditor.anchors[changes.getAt(entry, 2)];
			let av = new Vector(anchor.x, anchor.y);
			for (let control of anchor.children()) {
				for (let line of control.children()) {
					let lv = new Vector(line.x, line.y);
					if (av.subtract(lv).normalize().equalTo(new Vector(-1, 0))) line.angleDegrees = 180;
					else line.angleDegrees = - av.subtract(lv).angleSigned(new Vector(1, 0));
					line.width = av.distance(lv);
				}
			}
		},

		async Edsheet_Event186_Act1(runtime, localVars)
		{
			let changes = runtime.objects.changes_buffer.getFirstInstance();
			const entry = changes.instVars.current_action;
			RoadEditor.newPoint(runtime, new Vector(changes.getAt(entry, 3), changes.getAt(entry, 4)));
			RoadEditor.showFullEditor();
			if (changes.getAt(entry, 5) != 0) {
				RoadEditor.moveControl(changes.getAt(entry, 2), false, new Vector(changes.getAt(entry, 5), changes.getAt(entry, 6)));
			}
			if (changes.getAt(entry, 7) != 0) {
				RoadEditor.moveControl(changes.getAt(entry, 2), true, new Vector(changes.getAt(entry, 7), changes.getAt(entry, 8)));
			}
		},

		async Edsheet_Event187_Act1(runtime, localVars)
		{
			let changes = runtime.objects.changes_buffer.getFirstInstance();
			const entry = changes.instVars.current_action;
			RoadEditor.removePoint(changes.getAt(entry, 2));
		},

		async Edsheet_Event188_Act1(runtime, localVars)
		{
			let changes = runtime.objects.changes_buffer.getFirstInstance();
			const entry = changes.instVars.current_action;
			RoadEditor.loop(runtime, !RoadEditor.track.loop);
			if (RoadEditor.track.loop) {
				if (changes.getAt(entry, 2) != 0) {
					RoadEditor.moveControl(0, false, new Vector(changes.getAt(entry, 2), changes.getAt(entry, 3)));
				}
				if (changes.getAt(entry, 4) != 0) {
					RoadEditor.moveControl(RoadEditor.track.pointsEnd, true, new Vector(changes.getAt(entry, 4), changes.getAt(entry, 5)));
				}
			}
			if (runtime.globalVars.EdState != runtime.globalVars.EDITOR_READY) RoadEditor.showFullEditor();
			else RoadEditor.hideFullEditor();
		},

		async Edsheet_Event208_Act7(runtime, localVars)
		{
			let arr = runtime.objects.RoadPoints.getFirstInstance();
			RoadEditor.exportToCArray(arr);
		},

		async Edsheet_Event209(runtime, localVars)
		{
			let js = runtime.objects.JSON.getFirstInstance();
			let data = js.getJsonDataCopy();
			let arr = runtime.objects.MapElement.getAllInstances();
			data["objects"] = [];
			arr.sort((a, b) => { return a.zIndex - b.zIndex; });
			for (const item of arr) data["objects"].push({"x": item.x, "y": item.y, "type": item.objectType.name + "_" + item.animationName, "angle": item.angleDegrees});
			js.setJsonDataCopy(data);
		},

		async Edsheet_Event213(runtime, localVars)
		{
			const furl = localVars.ImageName + ".png";
			const link = await runtime.assets.getProjectFileUrl(furl);
			runtime.callFunction("LoadBackground", link);
		},

		async Edsheet_Event216_Act2(runtime, localVars)
		{
			RoadEditor.loadFromCArray(runtime.objects.RoadPoints.getFirstInstance());
			RoadEditor.hideFullEditor();
		},

		async Edsheet_Event218_Act1(runtime, localVars)
		{
			RoadEditor.cleanSlate();
		},

		async Edmenusheet_Event15_Act2(runtime, localVars)
		{
			let maps = runtime.objects.map_names.getFirstInstance().getDataMap();
			console.log(maps);
			let order = runtime.objects.MapOrdering.getFirstInstance();
			
			let sorting_functions = [(a, b) => {
				return a[1]["name"].localeCompare(b[1]["name"]);
			}, (a, b) => {
				return b[1]["created"] - a[1]["created"];
			}, (a, b) => {
				return b[1]["modified"] - a[1]["modified"];
			}];
			
			// Create items array
			var keys = maps.keys()
			let items = [];
			for (let item of maps.keys()) {
				items.push([item, JSON.parse(maps.get(item))]);
			}
			
			console.log(items);
			items.sort(sorting_functions[localVars.Option]);
			console.log(items);
			
			order.setSize(items.length);
			for (let i = 0; i < items.length; i++) {
				order.setAt(items[i][0], i);
			}
		},

		async Edmenusheet_Event34_Act1(runtime, localVars)
		{
			function download(filename, text) {
			  var element = document.createElement('a');
			  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
			  element.setAttribute('download', filename);
			
			  element.style.display = 'none';
			  document.body.appendChild(element);
			
			  element.click();
			
			  document.body.removeChild(element);
			}
			
			// Start file download.
			let js = runtime.objects.JSON.getFirstInstance();
			let data = js.getJsonDataCopy();
			download(data["name"] + ".json", js.toBeautifiedString());
		},

		async Gamesheet_Event106_Act1(runtime, localVars)
		{
			const obs = runtime.objects.obstacle.getFirstPickedInstance();
			const car = runtime.objects.car_edge_collision.getFirstPickedInstance();
			const collision = SAT_collision(car, obs);
			//console.log(collision);
			
			if (collision.collided) {
			const point = get_collision_point(car, obs, collision);
			//console.log(point);
			let new_spark = runtime.objects.EdgeSparks.createInstance("Level", point.x, point.y, false);
			new_spark.angleDegrees = car.angleDegrees - 180;
			}
			
			/*
			// debug stuff here
			let gui = runtime.layout.getLayer("GUI");
			let lay = runtime.layout.getLayer("Layout");
			
			function get_point(param) {
				return layer_to_layer_px(param.x, param.y, lay, gui);
			}
			let vals = [];
			vals.push(get_point(point.inc[0]));
			vals.push(get_point(point.inc[1]));
			vals.push(get_point(point.p0));
			vals.push(get_point(point.ref[0]));
			vals.push(get_point(point.ref[1]));
			vals.push(get_point(point.p3));
			vals.push(get_point(point.cut[0]));
			vals.push(get_point(point.cut[1]));
			vals.push(get_point(collision.obj));
			vals.push(get_point(Vector.add(Vector.multiply(collision.normal, 20), collision.obj)));
			let arr = runtime.objects.ddraw.getFirstInstance();
			for (let i = 0; i < vals.length; i++) {
				arr.setAt(vals[i][0], i, 0);
				arr.setAt(vals[i][1], i, 1);
			}
			*/
			
		},

		async Gamesheet_Event115(runtime, localVars)
		{
			// let's perform collision checks for cars! yay!
			if (runtime.globalVars.GameState == runtime.globalVars.GAME_ACTIVE) {
			const dt = runtime.dt;
			const all_cars = runtime.objects.Car.getAllInstances();
			for (let index1 = 0; index1 < all_cars.length; index1++) {
				for (let index2 = 0; index2 < all_cars.length; index2++) {
					if (index1 == index2) continue;
					
					let cars = [all_cars[index1], all_cars[index2]];
					let [cols, vecs, angdiffs] = [[], [], []];
					for (let car of cars) {
						cols.push(car.getChildAt(0));
						vecs.push([car.behaviors.Car.vectorX, car.behaviors.Car.vectorY]);
						angdiffs.push(car.behaviors.Car.facingAngle - car.angle);
						//car.x += car.behaviors.Car.vectorX * dt;
						//car.y += car.behaviors.Car.vectorY * dt;
						//car.angle = car.behaviors.Car.facingAngle;
					}
					const col_data = SAT_collision(cols[0], cols[1]);
					if (col_data.collided) {
						const point = get_collision_point(cols[0], cols[1], col_data);
						let new_v = [[0, 0], [0, 0]];
						let new_av = [0, 0];
						[new_v[0][0], new_v[0][1], new_av[0], new_v[1][0], new_v[1][1], new_av[1]] = car_collision_resolution(cars[0], cars[1], col_data, point, runtime);
						for (let i = 0; i < 2; i++) {
							cars[i].x -= col_data.overlap.x / 2 * (-i * 2 + 1) * ((col_data.obj === cars[0]) * 2 - 1);
							cars[i].y -= col_data.overlap.y / 2 * (-i * 2 + 1) * ((col_data.obj === cars[0]) * 2 - 1);
							cars[i].behaviors.Car.setImpulse(new_v[i][0], new_v[i][1]);
							cars[i].behaviors.Car.setVector(new_v[i][0], new_v[i][1]);
							//cars[i].behaviors.Car.spin = new_av[i] * (-i * 2 + 1);
						}
					}
					/*
					for (let i = 0; i < 2; i++) {
						cars[i].x -= vecs[i][0] * dt;
						cars[i].y -= vecs[i][1] * dt;
						cars[i].angle -= angdiffs[i];
					}
					*/
				}
			}
			}
		},

		async Gamesheet_Event116(runtime, localVars)
		{
			// calculate car positions
			function getCP(id) {
				const CP = runtime.objects.checkpoint.getAllInstances();
				for (let checkpoint of CP) {
					if (checkpoint.instVars.checkID == id) { return new Vector(checkpoint.x, checkpoint.y); }
				}
			}
			// TODO: Rewrite using curve data
			if (runtime.layout.name != "ParkingLot") {
				const dt = runtime.dt;
				const all_cars = runtime.objects.Car.getAllInstances();
				const CPs = runtime.objects.checkpoint.getAllInstances().length;
				let results = [];
				for (let car of all_cars) {
					let [posx, posy] = car.getImagePoint("Front");
					let col = car.getChildAt(0);
					let txt = col.getChildAt(0);
					let newCP = getCP(col.instVars.ToCheckpoint);
					let oldCP = getCP((col.instVars.ToCheckpoint - 1 + CPs) % CPs);
					let completion_fraction = new Vector(posx, posy).distance(oldCP) / oldCP.distance(newCP);
					let pos = (col.instVars.Lap) * CPs + col.instVars.ToCheckpoint + completion_fraction;
					//console.log(col, pos);
					results.push({txt: txt, pos: pos});
				}
				results = results.sort((a, b) => {return b.pos - a.pos});
				for (let index = 0; index < results.length; index++) results[index].txt.text = String(index + 1);
			}
		},

		async Gamesheet_Event145_Act1(runtime, localVars)
		{
			RoadEditor.cleanSlate();
		},

		async Gamesheet_Event146_Act1(runtime, localVars)
		{
			RoadEditor.cleanSlate();
		},

		async Gamesheet_Event168(runtime, localVars)
		{
			const furl = localVars.map_name + ".json";
			const link = await runtime.assets.getProjectFileUrl(furl);
			runtime.callFunction("GetMap", link);
		},

		async Gamesheet_Event173_Act2(runtime, localVars)
		{
			let array = runtime.objects.RoadPoints.getFirstInstance();
			RoadEditor.loadFromCArray(array);
			RoadEditor.hideFullEditor();
		},

		async Gamesheet_Event179(runtime, localVars)
		{
			for (let m = 0; m < RoadEditor.meshes.length; m++) {
				const segment = RoadEditor.meshes[m];
				const mesh_width = segment.imageWidth * segment.imageScaleX;
				let left_border = runtime.objects.border.createInstance("Level", 0, 0, false);
				let right_border = runtime.objects.border.createInstance("Level", 0, 0, false);
				//left_border.isVisible = false;
				//right_border.isVisible = false;
			
				let curve = RoadEditor.track.segments[m];
			
				let length = curve.getArcLength(); // rough estimate
				const bb = curve.getQuickBB();
				const center = bb[0].add(bb[1]).divide(2);
				let size = bb[1].subtract(bb[0]).add(new Vector(mesh_width + 100, mesh_width + 100));
				size.y = Math.max(size.y, length);
				size.x = Math.max(size.x, mesh_width);
				const bbox = {
					left: center.x - (size.x) / 2,
					top: center.y - (size.y) / 2,
					width: size.x,
					height: size.y
				};
				let steps = Math.ceil(length / 25);
				const curvature = curve.getMaxCurvature(steps);
				if (curvature > 1e-3) steps = Math.round(steps * Math.log(curvature * 10000) / 2);
				length = curve.createLUT(steps); // refined estimate
				//console.warn(curve.getMaxCurvature(steps));
			
				left_border.releaseMesh();
				left_border.createMesh(2, steps + 1);
				left_border.x = center.x;
				left_border.y = center.y;
				left_border.width = size.x;
				left_border.height = size.y;
				
				right_border.releaseMesh();
				right_border.createMesh(2, steps + 1);
				right_border.x = center.x;
				right_border.y = center.y;
				right_border.width = size.x;
				right_border.height = size.y;
			
				for (let i = 0; i <= steps; i++) {
					const d = i / steps;
					let ll = curve.getPointOffset(d, -mesh_width / 2 - 80);
					let lr = curve.getPointOffset(d, -mesh_width / 2 - 20);
					let rl = curve.getPointOffset(d, mesh_width / 2 + 20);
					let rr = curve.getPointOffset(d, mesh_width / 2 + 80);
					const v = curve.getDistanceOfPoint(d) / length;
					ll = Editor.coordsInBBox(bbox, ll);
					lr = Editor.coordsInBBox(bbox, lr);
					rl = Editor.coordsInBBox(bbox, rl);
					rr = Editor.coordsInBBox(bbox, rr);
					console.log(ll, rl);
					left_border.setMeshPoint(0, steps - i, {x: ll[0], y: ll[1], u: 0, v: v});
					left_border.setMeshPoint(1, steps - i, {x: lr[0], y: lr[1], u: 1, v: v});
					right_border.setMeshPoint(0, steps - i, {x: rl[0], y: rl[1], u: 0, v: v});
					right_border.setMeshPoint(1, steps - i, {x: rr[0], y: rr[1], u: 1, v: v});
				}
			}
			// checkpoints
			let start = runtime.objects.track_start.getFirstInstance();
			// start checkpoint
			let zero = runtime.objects.checkpoint.createInstance("Level", start.getImagePointX("Checkpoint"), start.getImagePointY("Checkpoint"), false);
			zero.instVars.checkID = 0;
			zero.instVars.isStart = true;
			let vector = RoadEditor.track.segments[0].getTangent(1);
			let angle = vector.angleSigned(new Vector(1, 0));
			zero.angleDegrees = -angle + 90;
			zero.isVisible = false;
			
			let end = runtime.objects.track_end.getFirstInstance();
			
			let last_check = RoadEditor.track.numSegments - 1;
			if (RoadEditor.track.loop) {
				last_check += 1;
				zero.instVars.isEnd = true;
			} else {
				zero.instVars.isEnd = false;
				let finish = runtime.objects.checkpoint.createInstance("Level", end.getImagePointX("Checkpoint"), end.getImagePointY("Checkpoint"), false);
				vector = RoadEditor.track.segments[RoadEditor.track.segmentsEnd].getTangent(1);
				angle = vector.angleSigned(new Vector(1, 0));
				finish.angleDegrees = -angle + 90;
				finish.instVars.checkID = RoadEditor.track.segmentsEnd;
				finish.instVars.isStart = false;
				finish.instVars.isEnd = true;
				finish.isVisible = false;
			}
			
			for (let i = 1; i < last_check; i++) {
				let curve = RoadEditor.track.segments[i];
				vector = curve.getTangent(1);
				angle = vector.angleSigned(new Vector(1, 0));
				let new_check = runtime.objects.checkpoint.createInstance("Level", curve.p1.x, curve.p1.y, false);
				new_check.instVars.checkID = i;
				new_check.instVars.isEnd = false;
				new_check.instVars.isStart = false;
				new_check.angleDegrees = -angle + 90;
				new_check.isVisible = false;
			}
		},

		async Gamesheet_Event194_Act1(runtime, localVars)
		{
			const sprite = runtime.getInstanceByUid(localVars.SpriteUID);
			const [IPx, IPy] = sprite.getImagePoint(localVars.ImagePointName);
			if (IPx === sprite.x && IPy === sprite.y) {
				localVars.Result = 0;
			}
		},

		async Gamesheet_Event198_Act2(runtime, localVars)
		{
			[localVars.gui_x, localVars.gui_y] = layer_to_layer_px(localVars.coin_x, localVars.coin_y, runtime.layout.getLayer("Level"), runtime.layout.getLayer("GUI"));
			let icon = runtime.getInstanceByUid(623);
			localVars.to_x = icon.x;
			localVars.to_y = icon.y;
		},

		async Gamesheet_Event203_Act1(runtime, localVars)
		{
			[localVars.x, localVars.y] = layer_to_layer_px(localVars.x, localVars.y, runtime.layout.getLayer("Level"), runtime.layout.getLayer("GUI"));
		},

		async Gamesheet_Event212(runtime, localVars)
		{
			const furl = localVars.ImageName + ".png";
			const link = await runtime.assets.getProjectFileUrl(furl);
			runtime.callFunction("LoadBackground", link);
		},

		async Menusheet_Event19_Act1(runtime, localVars)
		{
			localVars.layers = runtime.layout.getAllLayers().length;
		},

		async Enemyai_Event18_Act2(runtime, localVars)
		{
			let car = runtime.objects.Car.getFirstPickedInstance();
			let road = runtime.objects.meshedRoad.getFirstPickedInstance();
			let index = road.getParent().instVars.point;
			let curve = RoadEditor.track.segments[index];
			let car_pos = new Vector(car.x, car.y);
			let vector = curve.getTangent(curve.getClosestPoint(car_pos)).normalize();
			let to_curve = curve.getPoint(curve.getClosestPoint(car_pos)).subtract(car_pos).normalize().divide(2);
			localVars.AngleToNode = -vector.add(to_curve).angleSigned(new Vector(1, 0));
		},

		async Levelinits_Event8_Act3(runtime, localVars)
		{
			// todo: set timer angle
			let vector = RoadEditor.track.segments[0].getTangent(1);
			let angle = vector.angleSigned(new Vector(1, 0));
			let timer = runtime.objects.timer.getFirstInstance();
			timer.angleDegrees = -angle + 90;
		}

};

self.C3.ScriptsInEvents = scriptsInEvents;

