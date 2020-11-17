import { tf } from '../../dist/tfjs.esm.js';
import * as blazeface from './blazeface.js';
import * as pipe from './facepipeline.js';
import * as coords from './coords.js';

class MediaPipeFaceMesh {
  constructor(blazeFace, blazeMeshModel, irisModel, config) {
    this.pipeline = new pipe.Pipeline(blazeFace, blazeMeshModel, irisModel, config);
    if (config) this.config = config;
  }

  async estimateFaces(input, config) {
    if (config) this.config = config;
    const predictions = await this.pipeline.predict(input, config);
    const results = [];
    for (const prediction of (predictions || [])) {
      // guard against disposed tensors on long running operations such as pause in middle of processing
      if (prediction.isDisposedInternal) continue;
      const mesh = prediction.coords ? prediction.coords.arraySync() : null;
      const annotations = {};
      if (mesh && mesh.length > 0) {
        for (const key in coords.MESH_ANNOTATIONS) {
          if (this.config.iris.enabled || key.includes('Iris') === false) {
            annotations[key] = coords.MESH_ANNOTATIONS[key].map((index) => mesh[index]);
          }
        }
      }
      results.push({
        confidence: prediction.confidence || 0,
        box: prediction.box ? [prediction.box.startPoint[0], prediction.box.startPoint[1], prediction.box.endPoint[0] - prediction.box.startPoint[0], prediction.box.endPoint[1] - prediction.box.startPoint[1]] : 0,
        mesh,
        annotations,
        image: prediction.image ? tf.clone(prediction.image) : null,
      });
      if (prediction.coords) prediction.coords.dispose();
      if (prediction.image) prediction.image.dispose();
    }
    return results;
  }
}

async function load(config) {
  const models = await Promise.all([
    blazeface.load(config),
    tf.loadGraphModel(config.mesh.modelPath, { fromTFHub: config.mesh.modelPath.includes('tfhub.dev') }),
    tf.loadGraphModel(config.iris.modelPath, { fromTFHub: config.iris.modelPath.includes('tfhub.dev') }),
  ]);
  const faceMesh = new MediaPipeFaceMesh(models[0], models[1], models[2], config);
  // eslint-disable-next-line no-console
  console.log(`Human: load model: ${config.mesh.modelPath.match(/\/(.*)\./)[1]}`);
  // eslint-disable-next-line no-console
  console.log(`Human: load model: ${config.iris.modelPath.match(/\/(.*)\./)[1]}`);
  return faceMesh;
}

exports.load = load;
exports.MediaPipeFaceMesh = MediaPipeFaceMesh;
exports.triangulation = coords.TRI468;
