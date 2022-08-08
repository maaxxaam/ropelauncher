import { Vector2 as Vector } from "./Vector2.js"

export function spawn(object_type, layer, position, hierarchy) { return object_type.createInstance(layer, position.x, position.y, hierarchy) }
export function setMeshAt(element, coord, position, uv) { element.setMeshPoint(coord.x, coord.y, {x: position.x, y: position.y, u: uv.x, v: uv.y}) }
export function setPosition(element, position) {
	element.x = position.x;
	element.y = position.y;
}
export function setSize(element, size) {
	element.width = size.x;
	element.height = size.y;
}
export function recreateMesh(element, x, y) {
	element.releaseMesh();
	element.createMesh(x, y);
}