import { Vector2 } from './Vector2.js'
import { spawn, setMeshAt, setSize, setPosition, recreateMesh } from './utils.js'

var Vector = Vector2;

export function coordsInBBox(BBox, point) {
	let LeftTop = new Vector(BBox.left, BBox.top);
	let relPoint = point.subtract(LeftTop);
	let coordx = relPoint.x / BBox.width;
	let coordy = relPoint.y / BBox.height;
	return new Vector(coordx, coordy);
}

export class BezierCurve {
	constructor(p0, c0, c1, p1) {
		this.p0 = p0;
		this.c0 = c0;
		this.c1 = c1;
		this.p1 = p1;
	}
	
	getWithCoefs(p0w, p1w, c0w, c1w) {
		return this.p0.multiply(p0w).add(this.p1.multiply(p1w)).add(this.c0.multiply(c0w)).add(this.c1.multiply(c1w));
	}
	
	getPoint(d) {
		const d2 = d*d;
		const d3 = d2*d;
		const p0w = -d3 + 3 * d2 - 3 * d + 1;
		const c0w = 3 * d3 - 6 * d2 + 3 * d;
		const c1w = -3 * d3 + 3 * d2;
		const p1w = d3;
		return this.getWithCoefs(p0w, p1w, c0w, c1w);
	}
	
	getVelocity(d) {
		const d2 = d*d;
		const p0w = -3 * d2 + 6 * d - 3;
		const c0w = 9 * d2 - 12 * d + 3;
		const c1w = -9 * d2 + 6 * d;
		const p1w = 3 * d2;
		return this.getWithCoefs(p0w, p1w, c0w, c1w);
	}
	
	getAcceleration(d) {
		const p0w = -6 * d + 6;
		const c0w = 18 * d - 12;
		const c1w = -18 * d + 6;
		const p1w = 6 * d;
		return this.getWithCoefs(p0w, p1w, c0w, c1w);
	}
	
	getCurvature(d) {
		let velocity = this.getVelocity(d);
		let acceleration = this.getAcceleration(d);
		return velocity.cross(acceleration) / Math.pow(velocity.magnitude(), 3);
	}
	
	getJerk() { return this.getWithCoefs(-6, 18, -18, 6) }
	
	getTangent(d) { return this.getVelocity(d).normalize() }
	
	getLeftNormal(d) {
		let tangent = this.getTangent(d);
		return new Vector(-tangent.y, tangent.x);
	}
	
	getRightNormal(d) {
		let tangent = this.getTangent(d);
		return new Vector(tangent.y, -tangent.x);
	}
	
	getPointOffset(d, offset) {
		let normal = this.getRightNormal(d);
		return this.getPoint(d).add(normal.multiply(offset));
	}
	
	getMeshPoints(d, width) {
		let offset = width / 2;
		let point = this.getPoint(d);
		let movement = this.getRightNormal(d).multiply(offset);
		return [point.subtract(movement), point.add(movement)];
	}
	
	getArcLength(n) {
		if (n === undefined) n = 20;
		const step = 1 / n;
		let last_point = this.p0;
		let result = 0;
		for (let i = 1; i <= n; i++) {
			let d = step * i;
			let cur_point = this.getPoint(d);
			result += cur_point.distance(last_point);
			last_point = cur_point;
		}
		this.arc = result;
		return result;
	}
	
	getMaxCurvature(n) {
		if (n === undefined) n = 20;
		const step = 1 / n;
		let result = 0;
		for (let i = 1; i <= n; i++) {
			let d = step * i;
			//console.log(this.getCurvature(d));
			result = Math.max(result, Math.abs(this.getCurvature(d)));
		}
		return result;
	}
	
	createLUT(n) {
		if (n === undefined) n = 20;
		this.LUT = [0];
		this.LUTstep = 1 / n;
		let last_point = this.p0;
		let arc_len = 0;
		for (let i = 1; i <= n; i++) {
			let d = this.LUTstep * i;
			let cur_point = this.getPoint(d);
			arc_len += cur_point.distance(last_point);
			this.LUT.push(arc_len);
			last_point = cur_point;
		}
		this.arc = arc_len;
		return arc_len;
	}
	
	getClosestPoint(position, n) {
		if (n === undefined) n = 20;
		const step = 1 / n;
		let result = 0;
		let dist = this.getPoint(0).distance(position);
		for (let i = 1; i <= n; i++) {
			let d = step * i;
			let new_dist = this.getPoint(d).distance(position);
			if (new_dist > dist) return result;
			result = d;
			dist = new_dist;
		}
		return result;
	}
	
	getPointDistance(dst) {
		if (this.LUT === undefined) throw Error("Generate LUT before using getPointByDistance()");
		if (dst > this.arc || dst < 0) throw Error("Distance is outside of arc");
		for (let i = 0; i < this.LUT.length - 1; i++) {
			if (this.LUT[i] > dst || this.LUT[i + 1] < dst) continue;
			
			let shift = (dst - this.LUT[i]) / (this.LUT[i + 1] - this.LUT[i]);
			return this.LUTstep * (i + shift);
		}
	}
	
	getPointByDistance(dst) {
		return this.getPoint(this.getPointDistance(dst));
	}
	
	getDistanceOfPoint(d) {
		if (this.LUT === undefined) throw Error("Generate LUT before using getDistanceOfPoint()");
		if (d == 1) return this.arc;
		let index = Math.floor(d / this.LUTstep);
		let shift = (d / this.LUTstep) - index;
		return this.LUT[index] + (this.LUT[index + 1] - this.LUT[index]) * shift;
	}
	
	getQuickBB() {
		let LeftTop = new Vector(Math.min(this.p0.x, this.c0.x, this.c1.x, this.p1.x), 
								 Math.min(this.p0.y, this.c0.y, this.c1.y, this.p1.y));
		let RightDown = new Vector(Math.max(this.p0.x, this.c0.x, this.c1.x, this.p1.x), 
								   Math.max(this.p0.y, this.c0.y, this.c1.y, this.p1.y));
		return [LeftTop, RightDown];
	}
}

export class AnchorPoint {
	constructor(anchor, control1, control2) {
		this.anchor = anchor;
		if (control1 !== undefined) this.control1 = control1;
		if (control2 !== undefined) this.control2 = control2;
	}
	
	moveAnchor(newPosition) {
		let delta = newPosition.subtract(this.anchor);
		this.anchor = newPosition;
		if (this.control1 !== undefined) this.control1 = this.control1.add(delta);
		if (this.control2 !== undefined) this.control2 = this.control2.add(delta);
	}
	
	hasLeftControl() { return this.control1 !== undefined }
	hasRightControl() { return this.control2 !== undefined }
	hasBothControls() { return this.hasLeftControl() && this.hasRightControl }
	
	addLeftControl(control1) {
		if (this.hasLeftControl()) throw Error("Do not use addLeftControl to move left control");
		this.control1 = control1;
	}
	
	addRightControl(control2) {
		if (this.hasRightControl()) throw Error("Do not use addRightControl to move right control");
		this.control2 = control2;
	}
	
	removeLeftControl() {
		if (this.hasLeftControl() == false) throw Error("Left control is not there");
		this.control1 = undefined;
	}
	
	removeRightControl() {
		if (this.hasRightControl() == false) throw Error("Right control is not there");
		this.control2 = undefined;
	}
	
	moveControl(control1, control2) {
		if (control1 !== undefined) {
			if (this.hasLeftControl() == false) throw Error("Cannot move nonexistent left control");
			this.control1 = control1;
			if (this.hasRightControl()) {
				let other_magnitude = this.control2.subtract(this.anchor).magnitude();
				let other_tangent = this.anchor.subtract(this.control1).normalize();
				this.control2 = this.anchor.add(other_tangent.multiply(other_magnitude));
			}
		}
		if (control2 !== undefined) {
			if (this.hasRightControl() == false) throw Error("Cannot move nonexistent right control");
			this.control2 = control2;
			if (this.hasLeftControl()) {
				let other_magnitude = this.control1.subtract(this.anchor).magnitude();
				let other_tangent = this.anchor.subtract(this.control2).normalize();
				this.control1 = this.anchor.add(other_tangent.multiply(other_magnitude));
			}
		}
		if (control1 === undefined && control2 === undefined) {
			throw Error("No new control positions provided");
		}
	}
}

export function CurveFromAnchors(start, end) {
	if (start.hasRightControl() == false) throw Error("Cannot create curve: missing right control for start anchor");
	if (end.hasLeftControl() == false) throw Error("Cannot create curve: missing left control for end anchor");
	return new BezierCurve(start.anchor, start.control2, end.control1, end.anchor);
}

export class BezierTrack {
	constructor() {
		this.points = [];
		this.segments = [];
		this._loop = false;
	}
	
	
	set loop(value) {
		if (value == false && this._loop == true) {
			this._loop = value;
			this.points[0].removeLeftControl();
			this.points[this.points.length - 1].removeRightControl();
			this.segments.pop();
		} else if (value == true && this._loop == false){
			this._loop = value;
			let start = this.points[0];
			let startControl = start.anchor.multiply(2).subtract(start.control2);
			let end = this.points[this.points.length - 1];
			let endControl = end.anchor.multiply(2).subtract(end.control1);
			this.points[0].addLeftControl(startControl);
			this.points[this.points.length - 1].addRightControl(endControl);
			this.segments.push(CurveFromAnchors(this.points[this.points.length - 1], this.points[0]));
		} else {
			console.warn("This track loop is already ", value);
		}
	}
	
	get loop() { return this._loop }
	
	get numPoints() { return this.points.length; };
	get pointsEnd() { return this.points.length - 1; };
	get numSegments() { return this.segments.length; };
	get segmentsEnd() { return this.segments.length - 1; };
	
	pushSegment(curve) {
		if (this.points.length === 0) {
			let first = new AnchorPoint(curve.p0, undefined, curve.c0);
			let last = new AnchorPoint(curve.p1, curve.c1);
			this.points.push(first, last);
			this.segments.push(curve);
		} else if (curve.p0.equalTo(this.points[this.pointsEnd].anchor)) {
			this.points[this.pointsEnd].addRightControl(curve.c0);
			let last = new AnchorPoint(curve.p1, curve.c1)
			this.points.push(last);
			this.segments.push(curve);
		} else {
			throw Error("Could not add segment to the curve")
		}
	}
	
	loadFromArray(array, loop){
		this.points = [];
		this.segments = [];
		this._loop = false;
		if (loop == true) {
			for (let i = 1; i < array.length - 3; i += 3) {
				this.pushSegment(new BezierCurve(array[i], array[i + 1], array[i + 2], array[i + 3]));
			}
			this.loop = true;
			this.anchorChanged(0, undefined, array[0], undefined);
			this.anchorChanged(this.pointsEnd, undefined, undefined, array[array.length - 1]);
		} else {
			for (let i = 0; i < array.length - 3; i += 3) {
				this.pushSegment(new BezierCurve(array[i], array[i + 1], array[i + 2], array[i + 3]))
			}
		}
	}
	
	insertAnchor(after, anchor) {
		this.points.splice(after + 1, 0, anchor);
		if (after + 1 == this.pointsEnd) {
			if (this.loop) {
				this.segments.splice(after + 1, 0, CurveFromAnchors(this.points[after + 1], this.points[0]));
			} else {
				this.points[after].addRightControl(this.points[after].anchor.multiply(2).subtract(this.points[after].control1));
			}
		} else {
			this.segments.splice(after + 1, 0, CurveFromAnchors(this.points[after + 1], this.points[after + 2]));
		}
		this.segments[after] = CurveFromAnchors(this.points[after], this.points[after + 1]);
	}
	
	insertSegmentAt(after, position) {
		let anchor = position;
		let before = this.points[after];

		if (before.hasRightControl()) {
			var control1 = anchor.add(before.control2.subtract(anchor).divide(2));
			var control2 = anchor.subtract(before.control2.subtract(anchor).divide(2));
		} else if (before.hasLeftControl()) {
			var control1 = anchor.add(before.control1.add(anchor).divide(2));
		} else throw Error("How come an anchor has no controls?");

		this.insertAnchor(after, new AnchorPoint(anchor, control1, control2));
	}
	
	removeAnchor(index) {
		if (index == 0) {
			this.points.splice(0, 1);
			this.segments.splice(0, 1);
			if (this.loop) {
				this.segments[this.segmentsEnd] = CurveFromAnchors(this.points[0], this.points[this.pointsEnd]);
			} else {
				this.points[0].removeLeftControl();
			}
		} else if (index == this.pointsEnd) {
			this.points.pop();
			this.segments.pop();
			if (this.loop == false) {
				this.points[this.pointsEnd].removeRightControl();
			} else {
				this.segments[index - 1] = CurveFromAnchors(this.points[index - 1], this.points[0]);
			}
		} else {
			this.points.splice(index, 1);
			this.segments.splice(index, 1);
			this.segments[index - 1] = CurveFromAnchors(this.points[index - 1], this.points[index]);
		}
	}
	
	addAnchor(anchor) {
		this.pushSegment(CurveFromAnchors(this.points[this.pointsEnd], anchor));
	}
	
	addAnchorAt(position) {
		if (this.loop) {
			this.insertSegmentAt(this.pointsEnd, position);
		} else {
			let anchor = position;
			let before = this.points[this.pointsEnd];
			let control2 = before.anchor.multiply(2).subtract(before.control1);
			let control1 = anchor.add(control2).divide(2);
			this.pushSegment(CurveFromAnchors(new AnchorPoint(this.points[this.pointsEnd].anchor, this.points[this.pointsEnd].control1, control2), new AnchorPoint(anchor, control1)));
		}
	}
	
	anchorChanged(index, anchor, control1, control2) {
		let state = this.points[index];
		if (anchor !== undefined) state.moveAnchor(anchor);
		if (control1 !== undefined) state.moveControl(control1, undefined);
		if (control2 !== undefined) state.moveControl(undefined, control2);
		this.points[index] = state;
		if (index == 0) {
			this.segments[0] = CurveFromAnchors(state, this.points[1]);
			if (this.loop) {
				this.segments[this.segmentsEnd] = CurveFromAnchors(this.points[this.pointsEnd], state);
			}
		} else if (index == this.pointsEnd) {
			if (this.loop) {
				this.segments[this.segmentsEnd - 1] = CurveFromAnchors(this.points[index - 1], state);
				this.segments[this.segmentsEnd] = CurveFromAnchors(state, this.points[0]);
			} else {
				this.segments[this.segmentsEnd] = CurveFromAnchors(this.points[index - 1], state);
			}
		} else {
			this.segments[index] = CurveFromAnchors(this.points[index], this.points[index + 1]);
			this.segments[index - 1] = CurveFromAnchors(this.points[index - 1], this.points[index]);
		}
	}
	
	saveAsArray() {
		let result = [];
		for (let item of this.points) {
			if (item.hasLeftControl()) result.push(item.control1);
			result.push(item.anchor);
			if (item.hasRightControl()) result.push(item.control2);
		}
		return result;
	}
}

export class CurveEditor {
	constructor() {
		this.track = new BezierTrack();
		this.anchors = [];
		this.controls = [];
		this.meshes = [];
	}
	
	insertPoint(runtime, after, position) {
		this.track.insertSegmentAt(after, position);
		this.renderFromTrack(runtime, after);
	}
	
	loop(runtime, value) {
		this.track.loop = value;
		this.renderFromTrack(runtime);
		if (value) {
			this.hideFinish(runtime);
		} else {
			this.placeFinish(runtime);
		}
	}
	
	moveAnchor(index, position) {
		this.track.anchorChanged(index, position, undefined, undefined);
		// move anchor
		setPosition(this.anchors[index], position);
		// move controls 
		if (this.track.points[index].hasLeftControl()) this.moveControl(index, false, this.track.points[index].control1);
		if (this.track.points[index].hasRightControl()) this.moveControl(index, true, this.track.points[index].control2);
	}
	
	moveControl(index, right, position) {
		if (right) {
			this.track.anchorChanged(index, undefined, undefined, position);
		} else {
			this.track.anchorChanged(index, undefined, position, undefined);
		}
		// move controls
		let indexes = this.getControlIndexes(index);
		if (indexes.left !== undefined) {
			setPosition(this.controls[indexes.left], this.track.points[index].control1);
		}
		if (indexes.right !== undefined) {
			setPosition(this.controls[indexes.right], this.track.points[index].control2);
		}
		// redraw meshes
		if (index == 0) {
			this.drawMesh(0);
			if (this.track.loop) {
				this.drawMesh(this.track.segmentsEnd);
			}
		} else if (index == this.track.pointsEnd) {
			this.drawMesh(this.track.segmentsEnd);
			if (this.track.loop) {
				this.drawMesh(this.track.segmentsEnd - 1);
			}
		} else {
			this.drawMesh(index);
			this.drawMesh(index - 1);
		}
	}
	
	newPoint(runtime, position, control1, control2) {
		if (control1 !== undefined) {
			this.track.addAnchor(new AnchorPoint(position, control1, control2));
		} else {
			this.track.addAnchorAt(position);
		}
		let i = this.track.pointsEnd;
		let control_handle = runtime.objects.control_handle;
		
		let new_anchor = spawn(runtime.objects.anchor_handle, "Level", this.track.points[i].anchor, false);
		new_anchor.instVars.point = i;
		new_anchor.isVisible = false;
		if (this.track.points[i - 1].hasRightControl()) {
			let rightControl = spawn(control_handle, "Level", this.track.points[i - 1].control2, true);
			rightControl.instVars.point = i - 1;
			rightControl.instVars.right = true;
			rightControl.isVisible = false;
			this.controls.push(rightControl);
			this.anchors[i - 1].addChild(rightControl, {destroyWithParent: true, transformX: true, transformY: true});
		}
		if (this.track.points[i].hasLeftControl()) {
			let leftControl = spawn(control_handle, "Level", this.track.points[i].control1, true);
			leftControl.instVars.point = i;
			leftControl.instVars.right = false;
			leftControl.isVisible = false;
			this.controls.push(leftControl);
			new_anchor.addChild(leftControl, {destroyWithParent: true, transformX: true, transformY: true});
		}
		if (this.track.points[i].hasRightControl()) {
			let rightControl = spawn(control_handle, "Level", this.track.points[i].control2, true);
			rightControl.instVars.point = i;
			rightControl.instVars.right = true;
			rightControl.isVisible = false;
			this.controls.push(rightControl);
			new_anchor.addChild(rightControl, {destroyWithParent: true, transformX: true, transformY: true});
		}
		this.anchors.push(new_anchor);
		// generate meshes if needed
		if (i == this.track.numSegments) {
			let mesh = runtime.objects.meshedRoad.createInstance("Level", 0, 0, false);
			this.meshes.push(mesh);
			this.anchors[i - 1].addChild(mesh, {destroyWithParent: true});
			this.drawMesh(this.meshes.length - 1);
		}
	}
	
	getControlIndexes(anchorIndex) {
		let indice = anchorIndex * 2 - (this.track.loop ? 0 : 1);
		if (indice == -1) return {right: 0};
		else if (indice == this.controls.length - 1) return {left: indice};
		else return {left: indice, right: indice + 1};
	}
	
	removePoint(index) {
		let mesh = this.meshes.splice(index, 1);
		let indexes = this.getControlIndexes(index)
		if (indexes.right !== undefined) this.controls.splice(indexes.right, 1);
		if (indexes.left !== undefined) this.controls.splice(indexes.left, 1);
		let to_remove = this.anchors.splice(index, 1)[0]
		let runtime = to_remove.runtime;
		to_remove.destroy();
		this.track.removeAnchor(index);
		if (index == this.track.numPoints) {
			if (this.track.loop == false) {
				this.meshes.pop().destroy();
				// remove right control
				this.controls.splice(this.controls.length - 1, 1)[0].destroy();
			} else {
				this.drawMesh(index - 1);
			}
		} else if (index == 0) {
			if (this.track.loop == false) {
				// remove left control
				this.controls.splice(0, 1)[0].destroy();
			} else {
				this.drawMesh(this.meshes.length - 1);
			}
		} else {
			this.drawMesh(index - 1);
		}
		this.updateAnchors();
		if (this.track.loop == false) this.placeFinish(runtime);
		this.placeStart(runtime);
	}
	
	updateAnchors() {
		for (let i = 0; i < this.anchors.length; i++) {
			let edit = this.anchors[i];
			edit.instVars.point = i;
			let control1 = edit.getChildAt(0);
			control1.instVars.point = i;
			let control2 = edit.getChildAt(1);
			if (control2 !== null) {
				if (control2.objectType.name === "control_handle") control2.instVars.point = i;
			}
		}
	}
	
	leaveControls(amount) {
		let result = 0;
		for (let i = 0; i < amount; i++) {
			let point = this.track.points[i];
			result += Number(point.hasLeftControl()) + Number(point.hasRightControl());
		}
		return result;
	}
	
	propagateOffsets(from) {
		let start = Math.max(1, from);
		for (let i = start; i < this.meshes.length; i++) {
			let segment = this.meshes[i];
			segment.imageOffsetY = this.meshes[i - 1].instVars.next_offset;	
			segment.instVars.next_offset = - ((segment.height - segment.imageOffsetY) % (segment.imageHeight * segment.imageScaleY));
		}
	}
	
	drawMesh(index, resolution) {
		if (resolution === undefined) resolution = 1;
		
		let segment = this.meshes[index];
		let runtime = segment.runtime;
		let mesh_width = segment.imageWidth * segment.imageScaleX;
		if (index != 0) {
			segment.imageOffsetY = this.meshes[index - 1].instVars.next_offset;	
		}

		let curve = this.track.segments[index];

		let length = curve.getArcLength(); // rough estimate
		let bb = curve.getQuickBB();
		let center = bb[0].add(bb[1]).divide(2);
		let size = bb[1].subtract(bb[0]).add(new Vector(mesh_width, mesh_width));
		size = new Vector(Math.max(size.x, mesh_width), Math.max(size.y, length));
		segment.instVars.next_offset = - ((size.y - segment.imageOffsetY) % (segment.imageHeight * segment.imageScaleY));
		const bbox = {
			left: center.x - (size.x) / 2,
			top: center.y - (size.y) / 2,
			width: size.x,
			height: size.y
		};
		
		let steps = Math.ceil(length / 25 * resolution);
		let curvature = curve.getMaxCurvature(steps);
		if (curvature > 1e-3) steps = Math.round(steps * Math.log(curvature * 10000) / 2);
		length = curve.createLUT(steps); // refined estimate
		
		recreateMesh(segment, 2, steps + 1);
		setPosition(segment, center);
		setSize(segment, size);

		for (let i = 0; i <= steps; i++) {
			let d = i / steps;
			
			let reverse = new Vector(0, steps - i);
			let texture = new Vector(0, curve.getDistanceOfPoint(d) / length);
			
			let ends = curve.getMeshPoints(d, mesh_width);
			ends[0] = coordsInBBox(bbox, ends[0]);
			ends[1] = coordsInBBox(bbox, ends[1]);
			
			setMeshAt(segment, reverse, ends[0], texture);
			setMeshAt(segment, reverse.addX(1), ends[1], texture.addX(mesh_width / segment.width));
		}
		if (index != this.meshes.length - 1) this.propagateOffsets(index);
		if (index == 0) this.placeStart(runtime)
		else if (index == this.track.segmentsEnd && this.track.loop == false) this.placeFinish(runtime);
	}
	
	renderFromTrack(runtime, from) {
		if (from === undefined) from = 0;
		// cleanup, just in case
		while (this.anchors.length > from) this.anchors.pop().destroy();
		while (this.controls.length > this.leaveControls(from)) this.controls.pop().destroy();
		while (this.meshes.length > from) this.meshes.pop().destroy();
		let anchor_handle = runtime.objects.anchor_handle;
		let control_handle = runtime.objects.control_handle;
		// generate anchor points
		for (let i = from; i < this.track.numPoints; i++) {
			const point = this.track.points[i];
			let new_anchor = spawn(anchor_handle, "Level", point.anchor, false);
			new_anchor.instVars.point = i;
			if (this.track.points[i].hasLeftControl()) {
				let leftControl = spawn(control_handle, "Level", point.control1, true);
				leftControl.instVars.point = i;
				leftControl.instVars.right = false;
				this.controls.push(leftControl);
				new_anchor.addChild(leftControl, {destroyWithParent: true, transformX: true, transformY: true});
			}
			if (this.track.points[i].hasRightControl()) {
				let rightControl = spawn(control_handle, "Level", point.control2, true);
				rightControl.instVars.point = i;
				rightControl.instVars.right = true;
				this.controls.push(rightControl);
				new_anchor.addChild(rightControl, {destroyWithParent: true, transformX: true, transformY: true});
			}
			this.anchors.push(new_anchor);
			// generate meshes if needed
			if (i < this.track.numSegments) {
				let mesh = runtime.objects.meshedRoad.createInstance("Level", 0, 0, false);
				this.meshes.push(mesh);
				new_anchor.addChild(mesh, {destroyWithParent: true});
				this.drawMesh(i);
			}
		}
	}
	
	loadFromCArray(array) {
		let runtime = array.runtime;
		let loop = (array.width % 3 == 0) ? true : false;
		let vector_array = [];
		for (let i = 0; i < array.width; i++) {
			vector_array.push(new Vector(array.getAt(i, 0), array.getAt(i, 1)));
		}
		this.track.loadFromArray(vector_array, loop);
		this.renderFromTrack(runtime);
	}
	
	showControls() {
		for (let item of this.controls) {
			item.isVisible = true;
			item.moveToTop();
			for (let child of item.allChildren()) {
				child.isVisible = true;
				child.moveAdjacentToInstance(item, false);
			}
		}
	}
	
	hideControls() {
		for (let item of this.controls) {
			item.isVisible = false;
			for (let child of item.allChildren()) {
				child.isVisible = false;
			}
		}
	}
	
	showAnchors() {
		for (let item of this.anchors) {
			item.isVisible = true
			item.moveToTop();
		}
	}
	
	hideAnchors() {
		for (let i of this.anchors) {
			i.isVisible = false;
		}
	}
	
	showFullEditor() {
		this.showControls();
		this.showAnchors();
	}
	
	hideFullEditor() {
		this.hideControls();
		this.hideAnchors();
	}
	
	placeStart(runtime) {
		let start = runtime.objects.track_start.getFirstInstance();
		start.removeFromParent();
		
		const buffer_pixels = 64;
		const orig_size = new Vector(start.imageWidth, start.imageHeight);
		const buffered_size = orig_size.add(new Vector(buffer_pixels, buffer_pixels));
		const steps = Math.floor(buffered_size.y / 32);
		
		let road = this.meshes[0];
		road.addChild(start);
		start.moveAdjacentToInstance(road, true);
		
		let curve = this.track.segments[0];
		let length = curve.arc;
		let position = curve.getPointByDistance(length - orig_size.y / 2);
		
		setPosition(start, position);
		setSize(start, buffered_size);
		recreateMesh(start, 2, steps + 1);
		
		let bbox = start.getBoundingBox();
		
		for (let i = 0; i <= steps; i++) {
			let dst = length - i * 32;
			let d = curve.getPointDistance(dst);
			let part = curve.getMeshPoints(d, orig_size.x);
			
			let coord = new Vector(0, steps - i);
			let texture = new Vector(0, 1 - i * 32 / orig_size.y);
			
			let point = coordsInBBox(bbox, part[0]);
			setMeshAt(start, coord, point, texture);
			
			point = coordsInBBox(bbox, part[1]);
			setMeshAt(start, coord.addX(1), point, texture.addX(1));
		}
		
		for (let i = 0; i < 4; i++) {
			const d = curve.getPointDistance(length - orig_size.y / 2 - 256 * Math.floor(i / 2));
			const angle = -curve.getTangent(d).angleSigned(new Vector(1, 0));
			position = curve.getPointOffset(d, 96 * ((i % 2) * 2 - 1));
			
			let bracket = runtime.objects.start_brackets.getAllInstances()[i];	
			bracket.moveAdjacentToInstance(start, true);
			bracket.angleDegrees = angle;
			setPosition(bracket, position);
		}
	}
	
	placeFinish(runtime) {
		let end = runtime.objects.track_end.getFirstInstance();
		end.removeFromParent();
		end.isVisible = true;
		
		const buffer_pixels = 64;
		const orig_size = new Vector(end.imageWidth, end.imageHeight);
		const buffered_size = orig_size.add(new Vector(buffer_pixels, buffer_pixels));
		const steps = Math.ceil(orig_size.y / 32);
		
		let road = this.meshes[this.meshes.length - 1];
		road.addChild(end);
		end.moveAdjacentToInstance(road, true);
		
		let curve = this.track.segments[this.track.segmentsEnd];
		let length = curve.arc;
		let position = curve.getPointByDistance(length - orig_size.y / 2);
		
		setPosition(end, position);
		setSize(end, buffered_size);
		recreateMesh(end, 2, steps + 1);
		
		let bbox = end.getBoundingBox();
		
		for (let i = 0; i <= steps; i++) {
			const dst = length - i * 32;
			const d = curve.getPointDistance(dst);
			const part = curve.getMeshPoints(d, orig_size.x);
			let coord = new Vector(0, steps - i);
			let texture = new Vector(0, 1 - i * 32 / orig_size.y);
			
			let point = coordsInBBox(bbox, part[0]);
			setMeshAt(end, coord, point, texture);
			
			point = coordsInBBox(bbox, part[1]);
			setMeshAt(end, coord.addX(1), point, texture.addX(1));
		}
	}
	
	hideFinish(runtime) {
		let end = runtime.objects.track_end.getFirstInstance();
		end.isVisible = false;
		setPosition(end, new Vector(-10000, -10000));
	}
	
	exportToCArray(arr) {
		let data = this.track.saveAsArray();
		arr.setSize(data.length, 2, 1);
		for (let i = 0; i < data.length; i++) {
			arr.setAt(data[i].x, i, 0);
			arr.setAt(data[i].y, i, 1);
		}
	}
	
	cleanSlate() {
		this.track = new BezierTrack();
		while (this.anchors.length > 0) this.anchors.pop().destroy();
		while (this.controls.length > 0) this.controls.pop().destroy();
		while (this.meshes.length > 0) this.meshes.pop().destroy();
	}
}