/* eslint-disable @typescript-eslint/naming-convention */
import { Vector3, Quaternion, Matrix, TmpVectors } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Nullable } from "@babylonjs/core/types";
import { GLTFLoader, ArrayItem } from "../glTFLoader";
import type { IGLTFLoaderExtension } from "../glTFLoaderExtension";
import type { INode } from "../glTFLoaderInterfaces";

import type { IEXTMeshGpuInstancing } from "../../glTF2Interface";

import "@babylonjs/core/Meshes/thinInstanceMesh";

const NAME = "EXT_mesh_gpu_instancing";

/**
 * [Proposed Specification](https://github.com/KhronosGroup/glTF/pull/1691)
 * [Playground Sample](https://playground.babylonjs.com/#QFIGLW#9)
 * !!! Experimental Extension Subject to Changes !!!
 */
export class EXT_mesh_gpu_instancing implements IGLTFLoaderExtension {
    /**
     * The name of this extension.
     */
    public readonly name = NAME;

    /**
     * Defines whether this extension is enabled.
     */
    public enabled: boolean;

    private _loader: GLTFLoader;

    /**
     * @internal
     */
    constructor(loader: GLTFLoader) {
        this._loader = loader;
        this.enabled = this._loader.isExtensionUsed(NAME);
    }

    /** @internal */
    public dispose() {
        (this._loader as any) = null;
    }

    /**
     * @internal
     */
    public loadNodeAsync(context: string, node: INode, assign: (babylonTransformNode: TransformNode) => void): Nullable<Promise<TransformNode>> {
        return GLTFLoader.LoadExtensionAsync<IEXTMeshGpuInstancing, TransformNode>(context, node, this.name, (extensionContext, extension) => {
            this._loader._disableInstancedMesh++;

            const promise = this._loader.loadNodeAsync(`/nodes/${node.index}`, node, assign);

            this._loader._disableInstancedMesh--;

            if (!node._primitiveBabylonMeshes) {
                return promise;
            }

            const promises = new Array<Promise<Nullable<Float32Array>>>();
            let instanceCount = 0;

            const loadAttribute = (attribute: string) => {
                if (extension.attributes[attribute] == undefined) {
                    promises.push(Promise.resolve(null));
                    return;
                }

                const accessor = ArrayItem.Get(`${extensionContext}/attributes/${attribute}`, this._loader.gltf.accessors, extension.attributes[attribute]);
                promises.push(this._loader._loadFloatAccessorAsync(`/accessors/${accessor.bufferView}`, accessor));

                if (instanceCount === 0) {
                    instanceCount = accessor.count;
                } else if (instanceCount !== accessor.count) {
                    throw new Error(`${extensionContext}/attributes: Instance buffer accessors do not have the same count.`);
                }
            };

            loadAttribute("TRANSLATION");
            loadAttribute("ROTATION");
            loadAttribute("SCALE");

            return promise.then((babylonTransformNode) => {
                return Promise.all(promises).then(([translationBuffer, rotationBuffer, scaleBuffer]) => {
                    const matrices = new Float32Array(instanceCount * 16);

                    TmpVectors.Vector3[0].copyFromFloats(0, 0, 0); // translation
                    TmpVectors.Quaternion[0].copyFromFloats(0, 0, 0, 1); // rotation
                    TmpVectors.Vector3[1].copyFromFloats(1, 1, 1); // scale

                    for (let i = 0; i < instanceCount; ++i) {
                        translationBuffer && Vector3.FromArrayToRef(translationBuffer, i * 3, TmpVectors.Vector3[0]);
                        rotationBuffer && Quaternion.FromArrayToRef(rotationBuffer, i * 4, TmpVectors.Quaternion[0]);
                        scaleBuffer && Vector3.FromArrayToRef(scaleBuffer, i * 3, TmpVectors.Vector3[1]);

                        Matrix.ComposeToRef(TmpVectors.Vector3[1], TmpVectors.Quaternion[0], TmpVectors.Vector3[0], TmpVectors.Matrix[0]);

                        TmpVectors.Matrix[0].copyToArray(matrices, i * 16);
                    }

                    for (const babylonMesh of node._primitiveBabylonMeshes!) {
                        (babylonMesh as Mesh).thinInstanceSetBuffer("matrix", matrices, 16, true);
                    }

                    return babylonTransformNode;
                });
            });
        });
    }
}

GLTFLoader.RegisterExtension(NAME, (loader) => new EXT_mesh_gpu_instancing(loader));