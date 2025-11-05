(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Hydra = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _sandbox = _interopRequireDefault(require("./lib/sandbox.js"));
var _arrayUtils = _interopRequireDefault(require("./lib/array-utils.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// handles code evaluation and attaching relevant objects to global and evaluation contexts

class EvalSandbox {
  constructor(parent, makeGlobal, userProps = []) {
    this.makeGlobal = makeGlobal;
    this.sandbox = (0, _sandbox.default)(parent);
    this.parent = parent;
    var properties = Object.keys(parent);
    properties.forEach(property => this.add(property));
    this.userProps = userProps;
  }
  add(name) {
    if (this.makeGlobal) window[name] = this.parent[name];
    // this.sandbox.addToContext(name, `parent.${name}`)
  }

  // sets on window as well as synth object if global (not needed for objects, which can be set directly)

  set(property, value) {
    if (this.makeGlobal) {
      window[property] = value;
    }
    this.parent[property] = value;
  }
  tick() {
    if (this.makeGlobal) {
      this.userProps.forEach(property => {
        this.parent[property] = window[property];
      });
      //  this.parent.speed = window.speed
    } else {}
  }
  eval(code) {
    this.sandbox.eval(code);
  }
}
var _default = exports.default = EvalSandbox;

},{"./lib/array-utils.js":12,"./lib/sandbox.js":17}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = formatArguments;
var _arrayUtils = _interopRequireDefault(require("./lib/array-utils.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// [WIP] how to treat different dimensions (?)
const DEFAULT_CONVERSIONS = {
  float: {
    'vec4': {
      name: 'sum',
      args: [[1, 1, 1, 1]]
    },
    'vec2': {
      name: 'sum',
      args: [[1, 1]]
    }
  }
};
function fillArrayWithDefaults(arr, len) {
  // fill the array with default values if it's too short
  while (arr.length < len) {
    if (arr.length === 3) {
      // push a 1 as the default for .a in vec4
      arr.push(1.0);
    } else {
      arr.push(0.0);
    }
  }
  return arr.slice(0, len);
}
const ensure_decimal_dot = val => {
  val = val.toString();
  if (val.indexOf('.') < 0) {
    val += '.';
  }
  return val;
};
function formatArguments(transform, startIndex, synthContext) {
  const defaultArgs = transform.transform.inputs;
  const userArgs = transform.userArgs;
  const {
    generators
  } = transform.synth;
  const {
    src
  } = generators; // depends on synth having src() function
  return defaultArgs.map((input, index) => {
    const typedArg = {
      value: input.default,
      type: input.type,
      //
      isUniform: false,
      name: input.name,
      vecLen: 0
      //  generateGlsl: null // function for creating glsl
    };
    if (typedArg.type === 'float') typedArg.value = ensure_decimal_dot(input.default);
    if (input.type.startsWith('vec')) {
      try {
        typedArg.vecLen = Number.parseInt(input.type.substr(3));
      } catch (e) {
        console.log(`Error determining length of vector input type ${input.type} (${input.name})`);
      }
    }

    // if user has input something for this argument
    if (userArgs.length > index) {
      typedArg.value = userArgs[index];
      if (typedArg.type === 'vec4') {
        if (!(typedArg.value.type === "GlslSource" || typedArg.value.getTexture)) {
          throw new Error("Arguments must be a texture or GlslSource");
        }
      }
      // do something if a composite or transform

      if (typeof userArgs[index] === 'function') {
        // if (typedArg.vecLen > 0) { // expected input is a vector, not a scalar
        //    typedArg.value = (context, props, batchId) => (fillArrayWithDefaults(userArgs[index](props), typedArg.vecLen))
        // } else {
        typedArg.value = (context, props, batchId) => {
          try {
            const val = userArgs[index](props);
            if (typeof val === 'number') {
              return val;
            } else {
              console.warn('function does not return a number', userArgs[index]);
            }
            return input.default;
          } catch (e) {
            console.warn('ERROR', e);
            return input.default;
          }
        };
        //  }

        typedArg.isUniform = true;
      } else if (userArgs[index].constructor === Array) {
        //   if (typedArg.vecLen > 0) { // expected input is a vector, not a scalar
        //     typedArg.isUniform = true
        //     typedArg.value = fillArrayWithDefaults(typedArg.value, typedArg.vecLen)
        //  } else {
        //  console.log("is Array")
        // filter out values that are not a number
        // const filteredArray = userArgs[index].filter((val) => typeof val === 'number')
        // typedArg.value = (context, props, batchId) => arrayUtils.getValue(filteredArray)(props)
        typedArg.value = (context, props, batchId) => _arrayUtils.default.getValue(userArgs[index])(props);
        typedArg.isUniform = true;
        // }
      }
    }
    if (startIndex < 0) {} else {
      if (typedArg.value && typedArg.value.transforms) {
        const final_transform = typedArg.value.transforms[typedArg.value.transforms.length - 1];
        if (final_transform.transform.glsl_return_type !== input.type) {
          const defaults = DEFAULT_CONVERSIONS[input.type];
          if (typeof defaults !== 'undefined') {
            const default_def = defaults[final_transform.transform.glsl_return_type];
            if (typeof default_def !== 'undefined') {
              const {
                name,
                args
              } = default_def;
              typedArg.value = typedArg.value[name](...args);
            }
          }
        }
        typedArg.isUniform = false;
      } else if (typedArg.type === 'float' && typeof typedArg.value === 'number') {
        typedArg.value = ensure_decimal_dot(typedArg.value);
      } else if (typedArg.type.startsWith('vec') && typeof typedArg.value === 'object' && Array.isArray(typedArg.value)) {
        typedArg.isUniform = false;
        typedArg.value = `${typedArg.type}(${typedArg.value.map(ensure_decimal_dot).join(', ')})`;
      } else if (input.type === 'sampler2D') {
        // typedArg.tex = typedArg.value
        var x = typedArg.value;
        typedArg.value = () => x.getTexture();
        typedArg.isUniform = true;
      } else {
        // if passing in a texture reference, when function asks for vec4, convert to vec4
        if (typedArg.value.getTexture && input.type === 'vec4') {
          var x1 = typedArg.value;
          typedArg.value = src(x1);
          typedArg.isUniform = false;
        }
      }

      // add tp uniform array if is a function that will pass in a different value on each render frame,
      // or a texture/ external source

      if (typedArg.isUniform) {
        typedArg.name += startIndex;
        //  shaderParams.uniforms.push(typedArg)
      }
    }
    return typedArg;
  });
}

},{"./lib/array-utils.js":12}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
var _formatArguments = _interopRequireDefault(require("./format-arguments.js"));
var _arrayUtils = _interopRequireDefault(require("./lib/array-utils.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// Add extra functionality to Array.prototype for generating sequences in time

// converts a tree of javascript functions to a shader
function _default(transforms) {
  var shaderParams = {
    uniforms: [],
    // list of uniforms used in shader
    glslFunctions: [],
    // list of functions used in shader
    fragColor: ''
  };
  var gen = generateGlsl(transforms, shaderParams)('c', 'st');
  // console.log(gen)

  shaderParams.fragColor = gen;
  // remove uniforms with duplicate names
  let uniforms = {};
  shaderParams.uniforms.forEach(uniform => uniforms[uniform.name] = uniform);
  shaderParams.uniforms = Object.values(uniforms);
  return shaderParams;
}
function generateInputName(v, index) {
  return `${v}_i${index}`;
}
function generateGlsl(transforms, shaderParams) {
  var generator = (c, uv) => '';
  transforms.forEach((transform, i) => {
    // Accumulate uniforms to lazily add them to the output shader
    let inputs = (0, _formatArguments.default)(transform, shaderParams.uniforms.length);
    inputs.forEach(input => {
      if (input.isUniform) shaderParams.uniforms.push(input);
    });

    // Lazily generate glsl function definition
    if (!contains(transform, shaderParams.glslFunctions)) shaderParams.glslFunctions.push(transform);
    var prev = generator;
    if (transform.transform.type === 'src') {
      generator = (c, uv) => `${generateInputs(inputs, shaderParams)(`${c}${i}`, uv)}
         vec4 ${c} = ${shaderString(`${c}${i}`, uv, transform.name, inputs)};`;
    } else if (transform.transform.type === 'color') {
      generator = (c, uv) => `${generateInputs(inputs, shaderParams)(`${c}${i}`, uv)}
         ${prev(c, uv)}
         ${c} = ${shaderString(`${c}${i}`, `${c}`, transform.name, inputs)};`;
    } else if (transform.transform.type === 'coord') {
      generator = (c, uv) => `${generateInputs(inputs, shaderParams)(`${c}${i}`, uv)}
         ${uv} = ${shaderString(`${c}${i}`, `${uv}`, transform.name, inputs)};
         ${prev(c, uv)}`;
    } else if (transform.transform.type === 'combine') {
      generator = (c, uv) =>
      // combining two generated shader strings (i.e. for blend, mult, add funtions)
      `${generateInputs(inputs, shaderParams)(`${c}${i}`, uv)}
         ${prev(c, uv)}
         ${c} = ${shaderString(`${c}${i}`, `${c}`, transform.name, inputs)};`;
    } else if (transform.transform.type === 'combineCoord') {
      // combining two generated shader strings (i.e. for modulate functions)
      generator = (c, uv) => `${generateInputs(inputs, shaderParams)(`${c}${i}`, uv)}
         ${uv} = ${shaderString(`${c}${i}`, `${uv}`, transform.name, inputs)};
         ${prev(c, uv)}`;
    }
  });
  return generator;
}
function generateInputs(inputs, shaderParams) {
  let generator = (c, uv) => '';
  var prev = generator;
  inputs.forEach((input, i) => {
    if (input.value.transforms) {
      prev = generator;
      generator = (c, uv) => {
        let ci = generateInputName(c, i);
        let uvi = generateInputName(`${uv}_${c}`, i);
        return `vec2 ${uvi} = ${uv};${prev(c, uv)}
         ${generateGlsl(input.value.transforms, shaderParams)(ci, uvi)}`;
      };
    }
  });
  return generator;
}

// assembles a shader string containing the arguments and the function name, i.e. 'osc(uv, frequency)'
function shaderString(c, uv, method, inputs) {
  const str = inputs.map((input, i) => {
    if (input.isUniform) {
      return input.name;
    } else if (input.value && input.value.transforms) {
      // this by definition needs to be a generator
      // use the variable created for generator inputs in `generateInputs`
      return generateInputName(c, i);
    }
    return input.value;
  }).reduce((p, c) => `${p}, ${c}`, '');
  return `${method}(${uv}${str})`;
}

// merge two arrays and remove duplicates
function mergeArrays(a, b) {
  return a.concat(b.filter(function (item) {
    return a.indexOf(item) < 0;
  }));
}

// check whether array
function contains(object, arr) {
  for (var i = 0; i < arr.length; i++) {
    if (object.name == arr[i].name) return true;
  }
  return false;
}

},{"./format-arguments.js":2,"./lib/array-utils.js":12}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _glslSource = _interopRequireDefault(require("./glsl-source.js"));
var _glslFunctions = _interopRequireDefault(require("./glsl/glsl-functions.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
class GeneratorFactory {
  constructor({
    defaultUniforms,
    defaultOutput,
    extendTransforms = [],
    changeListener = () => {}
  } = {}) {
    this.defaultOutput = defaultOutput;
    this.defaultUniforms = defaultUniforms;
    this.changeListener = changeListener;
    this.extendTransforms = extendTransforms;
    this.generators = {};
    this.init();
  }
  init() {
    const functions = (0, _glslFunctions.default)();
    this.glslTransforms = {};
    this.generators = Object.entries(this.generators).reduce((prev, [method, transform]) => {
      this.changeListener({
        type: 'remove',
        synth: this,
        method
      });
      return prev;
    }, {});
    this.sourceClass = (() => {
      return class extends _glslSource.default {};
    })();

    // add user definied transforms
    if (Array.isArray(this.extendTransforms)) {
      functions.concat(this.extendTransforms);
    } else if (typeof this.extendTransforms === 'object' && this.extendTransforms.type) {
      functions.push(this.extendTransforms);
    }
    return functions.map(transform => this.setFunction(transform));
  }
  _addMethod(method, transform) {
    const self = this;
    this.glslTransforms[method] = transform;
    if (transform.type === 'src') {
      const func = (...args) => new this.sourceClass({
        name: method,
        transform: transform,
        userArgs: args,
        defaultOutput: this.defaultOutput,
        defaultUniforms: this.defaultUniforms,
        synth: self
      });
      this.generators[method] = func;
      this.changeListener({
        type: 'add',
        synth: this,
        method
      });
      return func;
    } else {
      this.sourceClass.prototype[method] = function (...args) {
        this.transforms.push({
          name: method,
          transform: transform,
          userArgs: args,
          synth: self
        });
        return this;
      };
    }
    return undefined;
  }
  setFunction(obj) {
    var processedGlsl = processGlsl(obj);
    if (processedGlsl) this._addMethod(obj.name, processedGlsl);
  }
}
const typeLookup = {
  'src': {
    returnType: 'vec4',
    args: [{
      type: 'vec2',
      name: '_st'
    }]
  },
  'coord': {
    returnType: 'vec2',
    args: [{
      type: 'vec2',
      name: '_st'
    }]
  },
  'color': {
    returnType: 'vec4',
    args: [{
      type: 'vec4',
      name: '_c0'
    }]
  },
  'combine': {
    returnType: 'vec4',
    args: [{
      type: 'vec4',
      name: '_c0'
    }, {
      type: 'vec4',
      name: '_c1'
    }]
  },
  'combineCoord': {
    returnType: 'vec2',
    args: [{
      type: 'vec2',
      name: '_st'
    }, {
      type: 'vec4',
      name: '_c0'
    }]
  }
};
// expects glsl of format
// {
//   name: 'osc', // name that will be used to access function as well as within glsl
//   type: 'src', // can be src: vec4(vec2 _st), coord: vec2(vec2 _st), color: vec4(vec4 _c0), combine: vec4(vec4 _c0, vec4 _c1), combineCoord: vec2(vec2 _st, vec4 _c0)
//   inputs: [
//     {
//       name: 'freq',
//       type: 'float', // 'float'   //, 'texture', 'vec4'
//       default: 0.2
//     },
//     {
//           name: 'sync',
//           type: 'float',
//           default: 0.1
//         },
//         {
//           name: 'offset',
//           type: 'float',
//           default: 0.0
//         }
//   ],
//  glsl: `
//    vec2 st = _st;
//    float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
//    float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
//    float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
//    return vec4(r, g, b, 1.0);
// `
// }

// // generates glsl function:
// `vec4 osc(vec2 _st, float freq, float sync, float offset){
//  vec2 st = _st;
//  float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
//  float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
//  float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
//  return vec4(r, g, b, 1.0);
// }`

function processGlsl(obj) {
  let t = typeLookup[obj.type];
  if (t) {
    let inputs = t.args.concat(obj.inputs);
    let args = inputs.map(input => `${input.type} ${input.name}`).join(', ');
    // console.log('args are ', args)

    let glslFunction = `
  ${t.returnType} ${obj.name}(${args}) {
      ${obj.glsl}
  }
`;
    // First input gets handled specially by generator
    obj.inputs = inputs.slice(1);
    return Object.assign({}, obj, {
      glsl: glslFunction
    });
  } else {
    console.warn(`type ${obj.type} not recognized`, obj, typeLookup);
  }
}
var _default = exports.default = GeneratorFactory;

},{"./glsl-source.js":5,"./glsl/glsl-functions.js":6}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _generateGlsl = _interopRequireDefault(require("./generate-glsl.js"));
var _utilityFunctions = _interopRequireDefault(require("./glsl/utility-functions.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// const formatArguments = require('./glsl-utils.js').formatArguments

// const glslTransforms = require('./glsl/composable-glsl-functions.js')

var GlslSource = function (obj) {
  this.transforms = [];
  this.transforms.push(obj);
  this.defaultOutput = obj.defaultOutput;
  this.synth = obj.synth;
  this.type = 'GlslSource';
  this.defaultUniforms = obj.defaultUniforms;
  return this;
};
GlslSource.prototype.addTransform = function (obj) {
  this.transforms.push(obj);
};
GlslSource.prototype.out = function (_output) {
  var output = _output || this.defaultOutput;

  // output.renderPasses(glsl)
  if (output) try {
    var glsl = this.glsl(output);
    this.synth.currentFunctions = [];
    output.render(glsl);
  } catch (error) {
    console.warn('shader could not compile', error);
  }
};
GlslSource.prototype.glsl = function () {
  //var output = _output || this.defaultOutput
  var self = this;
  // uniforms included in all shaders
  //  this.defaultUniforms = output.uniforms
  var passes = [];
  var transforms = [];
  //  console.log('output', output)
  this.transforms.forEach(transform => {
    if (transform.transform.type === 'renderpass') {
      // if (transforms.length > 0) passes.push(this.compile(transforms, output))
      // transforms = []
      // var uniforms = {}
      // const inputs = formatArguments(transform, -1)
      // inputs.forEach((uniform) => { uniforms[uniform.name] = uniform.value })
      //
      // passes.push({
      //   frag: transform.transform.frag,
      //   uniforms: Object.assign({}, self.defaultUniforms, uniforms)
      // })
      // transforms.push({name: 'prev', transform:  glslTransforms['prev'], synth: this.synth})
      console.warn('no support for renderpass');
    } else {
      transforms.push(transform);
    }
  });
  if (transforms.length > 0) passes.push(this.compile(transforms));
  return passes;
};
GlslSource.prototype.compile = function (transforms) {
  var shaderInfo = (0, _generateGlsl.default)(transforms, this.synth);
  var uniforms = {};
  shaderInfo.uniforms.forEach(uniform => {
    uniforms[uniform.name] = uniform.value;
  });
  var frag = `
  precision ${this.defaultOutput.precision} float;
  ${Object.values(shaderInfo.uniforms).map(uniform => {
    let type = uniform.type;
    switch (uniform.type) {
      case 'texture':
        type = 'sampler2D';
        break;
    }
    return `
      uniform ${type} ${uniform.name};`;
  }).join('')}
  uniform float time;
  uniform vec2 resolution;
  varying vec2 uv;
  uniform sampler2D prevBuffer;

  ${Object.values(_utilityFunctions.default).map(transform => {
    //  console.log(transform.glsl)
    return `
            ${transform.glsl}
          `;
  }).join('')}

  ${shaderInfo.glslFunctions.map(transform => {
    return `
            ${transform.transform.glsl}
          `;
  }).join('')}

  void main () {
    vec2 st = gl_FragCoord.xy/resolution.xy;

    ${shaderInfo.fragColor}
    gl_FragColor = c;
  }
  `;
  return {
    frag: frag,
    uniforms: Object.assign({}, this.defaultUniforms, uniforms)
  };
};
var _default = exports.default = GlslSource;

},{"./generate-glsl.js":3,"./glsl/utility-functions.js":7}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/*
Format for adding functions to hydra. For each entry in this file, hydra automatically generates a glsl function and javascript function with the same name. You can also ass functions dynamically using setFunction(object).

{
  name: 'osc', // name that will be used to access function in js as well as in glsl
  type: 'src', // can be 'src', 'color', 'combine', 'combineCoord'. see below for more info
  inputs: [
    {
      name: 'freq',
      type: 'float',
      default: 0.2
    },
    {
      name: 'sync',
      type: 'float',
      default: 0.1
    },
    {
      name: 'offset',
      type: 'float',
      default: 0.0
    }
  ],
    glsl: `
      vec2 st = _st;
      float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
      float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
      float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
      return vec4(r, g, b, 1.0);
   `
}

// The above code generates the glsl function:
`vec4 osc(vec2 _st, float freq, float sync, float offset){
 vec2 st = _st;
 float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
 float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
 float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
 return vec4(r, g, b, 1.0);
}`


Types and default arguments for hydra functions.
The value in the 'type' field lets the parser know which type the function will be returned as well as default arguments.

const types = {
  'src': {
    returnType: 'vec4',
    args: [{ type: 'vec2', name: '_st' }]
  },
  'coord': {
    returnType: 'vec2',
    args: [{ type: 'vec2', name: '_st'}]
  },
  'color': {
    returnType: 'vec4',
    args: [{ type: 'vec4', name: '_c0'}]
  },
  'combine': {
    returnType: 'vec4',
    args: [
      { type: 'vec4', name: '_c0'},
      { type: 'vec4', name: '_c1'}
    ]
  },
  'combineCoord': {
    returnType: 'vec2',
    args: [
      { type: 'vec2', name: '_st'},
      { type: 'vec4', name: '_c0'},
    ]
  }
}

*/
var _default = () => [{
  name: 'noise',
  type: 'src',
  inputs: [{
    type: 'float',
    name: 'scale',
    default: 10
  }, {
    type: 'float',
    name: 'offset',
    default: 0.1
  }],
  glsl: `   return vec4(vec3(_noise(vec3(_st*scale, offset*time))), 1.0);`
}, {
  name: 'voronoi',
  type: 'src',
  inputs: [{
    type: 'float',
    name: 'scale',
    default: 5
  }, {
    type: 'float',
    name: 'speed',
    default: 0.3
  }, {
    type: 'float',
    name: 'blending',
    default: 0.3
  }],
  glsl: `   vec3 color = vec3(.0);
   // Scale
   _st *= scale;
   // Tile the space
   vec2 i_st = floor(_st);
   vec2 f_st = fract(_st);
   float m_dist = 10.;  // minimun distance
   vec2 m_point;        // minimum point
   for (int j=-1; j<=1; j++ ) {
   for (int i=-1; i<=1; i++ ) {
   vec2 neighbor = vec2(float(i),float(j));
   vec2 p = i_st + neighbor;
   vec2 point = fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
   point = 0.5 + 0.5*sin(time*speed + 6.2831*point);
   vec2 diff = neighbor + point - f_st;
   float dist = length(diff);
   if( dist < m_dist ) {
   m_dist = dist;
   m_point = point;
   }
   }
   }
   // Assign a color using the closest point position
   color += dot(m_point,vec2(.3,.6));
   color *= 1.0 - blending*m_dist;
   return vec4(color, 1.0);`
}, {
  name: 'osc',
  type: 'src',
  inputs: [{
    type: 'float',
    name: 'frequency',
    default: 60
  }, {
    type: 'float',
    name: 'sync',
    default: 0.1
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   vec2 st = _st;
   float r = sin((st.x-offset/frequency+time*sync)*frequency)*0.5  + 0.5;
   float g = sin((st.x+time*sync)*frequency)*0.5 + 0.5;
   float b = sin((st.x+offset/frequency+time*sync)*frequency)*0.5  + 0.5;
   return vec4(r, g, b, 1.0);`
}, {
  name: 'shape',
  type: 'src',
  inputs: [{
    type: 'float',
    name: 'sides',
    default: 3
  }, {
    type: 'float',
    name: 'radius',
    default: 0.3
  }, {
    type: 'float',
    name: 'smoothing',
    default: 0.01
  }],
  glsl: `   vec2 st = _st * 2. - 1.;
   // Angle and radius from the current pixel
   float a = atan(st.x,st.y)+3.1416;
   float r = (2.*3.1416)/sides;
   float d = cos(floor(.5+a/r)*r-a)*length(st);
   return vec4(vec3(1.0-smoothstep(radius,radius + smoothing + 0.0000001,d)), 1.0);`
}, {
  name: 'gradient',
  type: 'src',
  inputs: [{
    type: 'float',
    name: 'speed',
    default: 0
  }],
  glsl: `   return vec4(_st, sin(time*speed), 1.0);`
}, {
  name: 'src',
  type: 'src',
  inputs: [{
    type: 'sampler2D',
    name: 'tex',
    default: NaN
  }],
  glsl: `   //  vec2 uv = gl_FragCoord.xy/vec2(1280., 720.);
   return texture2D(tex, fract(_st));`
}, {
  name: 'solid',
  type: 'src',
  inputs: [{
    type: 'float',
    name: 'r',
    default: 0
  }, {
    type: 'float',
    name: 'g',
    default: 0
  }, {
    type: 'float',
    name: 'b',
    default: 0
  }, {
    type: 'float',
    name: 'a',
    default: 1
  }],
  glsl: `   return vec4(r, g, b, a);`
}, {
  name: 'rotate',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'angle',
    default: 10
  }, {
    type: 'float',
    name: 'speed',
    default: 0
  }],
  glsl: `   vec2 xy = _st - vec2(0.5);
   float ang = angle + speed *time;
   xy = mat2(cos(ang),-sin(ang), sin(ang),cos(ang))*xy;
   xy += 0.5;
   return xy;`
}, {
  name: 'scale',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1.5
  }, {
    type: 'float',
    name: 'xMult',
    default: 1
  }, {
    type: 'float',
    name: 'yMult',
    default: 1
  }, {
    type: 'float',
    name: 'offsetX',
    default: 0.5
  }, {
    type: 'float',
    name: 'offsetY',
    default: 0.5
  }],
  glsl: `   vec2 xy = _st - vec2(offsetX, offsetY);
   xy*=(1.0/vec2(amount*xMult, amount*yMult));
   xy+=vec2(offsetX, offsetY);
   return xy;
   `
}, {
  name: 'pixelate',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'pixelX',
    default: 20
  }, {
    type: 'float',
    name: 'pixelY',
    default: 20
  }],
  glsl: `   vec2 xy = vec2(pixelX, pixelY);
   return (floor(_st * xy) + 0.5)/xy;`
}, {
  name: 'posterize',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'bins',
    default: 3
  }, {
    type: 'float',
    name: 'gamma',
    default: 0.6
  }],
  glsl: `   vec4 c2 = pow(_c0, vec4(gamma));
   c2 *= vec4(bins);
   c2 = floor(c2);
   c2/= vec4(bins);
   c2 = pow(c2, vec4(1.0/gamma));
   return vec4(c2.xyz, _c0.a);`
}, {
  name: 'shift',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'r',
    default: 0.5
  }, {
    type: 'float',
    name: 'g',
    default: 0
  }, {
    type: 'float',
    name: 'b',
    default: 0
  }, {
    type: 'float',
    name: 'a',
    default: 0
  }],
  glsl: `   vec4 c2 = vec4(_c0);
   c2.r += fract(r);
   c2.g += fract(g);
   c2.b += fract(b);
   c2.a += fract(a);
   return vec4(c2.rgba);`
}, {
  name: 'repeat',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'repeatX',
    default: 3
  }, {
    type: 'float',
    name: 'repeatY',
    default: 3
  }, {
    type: 'float',
    name: 'offsetX',
    default: 0
  }, {
    type: 'float',
    name: 'offsetY',
    default: 0
  }],
  glsl: `   vec2 st = _st * vec2(repeatX, repeatY);
   st.x += step(1., mod(st.y,2.0)) * offsetX;
   st.y += step(1., mod(st.x,2.0)) * offsetY;
   return fract(st);`
}, {
  name: 'modulateRepeat',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'repeatX',
    default: 3
  }, {
    type: 'float',
    name: 'repeatY',
    default: 3
  }, {
    type: 'float',
    name: 'offsetX',
    default: 0.5
  }, {
    type: 'float',
    name: 'offsetY',
    default: 0.5
  }],
  glsl: `   vec2 st = _st * vec2(repeatX, repeatY);
   st.x += step(1., mod(st.y,2.0)) + _c0.r * offsetX;
   st.y += step(1., mod(st.x,2.0)) + _c0.g * offsetY;
   return fract(st);`
}, {
  name: 'repeatX',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'reps',
    default: 3
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y += step(1., mod(st.x,2.0))* offset;
   return fract(st);`
}, {
  name: 'modulateRepeatX',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'reps',
    default: 3
  }, {
    type: 'float',
    name: 'offset',
    default: 0.5
  }],
  glsl: `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y += step(1., mod(st.x,2.0)) + _c0.r * offset;
   return fract(st);`
}, {
  name: 'repeatY',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'reps',
    default: 3
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   vec2 st = _st * vec2(1.0, reps);
   //  float f =  mod(_st.y,2.0);
   st.x += step(1., mod(st.y,2.0))* offset;
   return fract(st);`
}, {
  name: 'modulateRepeatY',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'reps',
    default: 3
  }, {
    type: 'float',
    name: 'offset',
    default: 0.5
  }],
  glsl: `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.x += step(1., mod(st.y,2.0)) + _c0.r * offset;
   return fract(st);`
}, {
  name: 'kaleid',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'nSides',
    default: 4
  }],
  glsl: `   vec2 st = _st;
   st -= 0.5;
   float r = length(st);
   float a = atan(st.y, st.x);
   float pi = 2.*3.1416;
   a = mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return r*vec2(cos(a), sin(a));`
}, {
  name: 'modulateKaleid',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'nSides',
    default: 4
  }],
  glsl: `   vec2 st = _st - 0.5;
   float r = length(st);
   float a = atan(st.y, st.x);
   float pi = 2.*3.1416;
   a = mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return (_c0.r+r)*vec2(cos(a), sin(a));`
}, {
  name: 'scroll',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'scrollX',
    default: 0.5
  }, {
    type: 'float',
    name: 'scrollY',
    default: 0.5
  }, {
    type: 'float',
    name: 'speedX',
    default: 0
  }, {
    type: 'float',
    name: 'speedY',
    default: 0
  }],
  glsl: `
   _st.x += scrollX + time*speedX;
   _st.y += scrollY + time*speedY;
   return fract(_st);`
}, {
  name: 'scrollX',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'scrollX',
    default: 0.5
  }, {
    type: 'float',
    name: 'speed',
    default: 0
  }],
  glsl: `   _st.x += scrollX + time*speed;
   return fract(_st);`
}, {
  name: 'modulateScrollX',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'scrollX',
    default: 0.5
  }, {
    type: 'float',
    name: 'speed',
    default: 0
  }],
  glsl: `   _st.x += _c0.r*scrollX + time*speed;
   return fract(_st);`
}, {
  name: 'scrollY',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'scrollY',
    default: 0.5
  }, {
    type: 'float',
    name: 'speed',
    default: 0
  }],
  glsl: `   _st.y += scrollY + time*speed;
   return fract(_st);`
}, {
  name: 'modulateScrollY',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'scrollY',
    default: 0.5
  }, {
    type: 'float',
    name: 'speed',
    default: 0
  }],
  glsl: `   _st.y += _c0.r*scrollY + time*speed;
   return fract(_st);`
}, {
  name: 'add',
  type: 'combine',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1
  }],
  glsl: `   return (_c0+_c1)*amount + _c0*(1.0-amount);`
}, {
  name: 'sub',
  type: 'combine',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1
  }],
  glsl: `   return (_c0-_c1)*amount + _c0*(1.0-amount);`
}, {
  name: 'layer',
  type: 'combine',
  inputs: [],
  glsl: `   return vec4(mix(_c0.rgb, _c1.rgb, _c1.a), clamp(_c0.a + _c1.a, 0.0, 1.0));`
}, {
  name: 'blend',
  type: 'combine',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 0.5
  }],
  glsl: `   return _c0*(1.0-amount)+_c1*amount;`
}, {
  name: 'mult',
  type: 'combine',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1
  }],
  glsl: `   return _c0*(1.0-amount)+(_c0*_c1)*amount;`
}, {
  name: 'diff',
  type: 'combine',
  inputs: [],
  glsl: `   return vec4(abs(_c0.rgb-_c1.rgb), max(_c0.a, _c1.a));`
}, {
  name: 'modulate',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 0.1
  }],
  glsl: `   //  return fract(st+(_c0.xy-0.5)*amount);
   return _st + _c0.xy*amount;`
}, {
  name: 'modulateScale',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'multiple',
    default: 1
  }, {
    type: 'float',
    name: 'offset',
    default: 1
  }],
  glsl: `   vec2 xy = _st - vec2(0.5);
   xy*=(1.0/vec2(offset + multiple*_c0.r, offset + multiple*_c0.g));
   xy+=vec2(0.5);
   return xy;`
}, {
  name: 'modulatePixelate',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'multiple',
    default: 10
  }, {
    type: 'float',
    name: 'offset',
    default: 3
  }],
  glsl: `   vec2 xy = vec2(offset + _c0.x*multiple, offset + _c0.y*multiple);
   return (floor(_st * xy) + 0.5)/xy;`
}, {
  name: 'modulateRotate',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'multiple',
    default: 1
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   vec2 xy = _st - vec2(0.5);
   float angle = offset + _c0.x * multiple;
   xy = mat2(cos(angle),-sin(angle), sin(angle),cos(angle))*xy;
   xy += 0.5;
   return xy;`
}, {
  name: 'modulateHue',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1
  }],
  glsl: `   return _st + (vec2(_c0.g - _c0.r, _c0.b - _c0.g) * amount * 1.0/resolution);`
}, {
  name: 'invert',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1
  }],
  glsl: `   return vec4((1.0-_c0.rgb)*amount + _c0.rgb*(1.0-amount), _c0.a);`
}, {
  name: 'contrast',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1.6
  }],
  glsl: `   vec4 c = (_c0-vec4(0.5))*vec4(amount) + vec4(0.5);
   return vec4(c.rgb, _c0.a);`
}, {
  name: 'brightness',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 0.4
  }],
  glsl: `   return vec4(_c0.rgb + vec3(amount), _c0.a);`
}, {
  name: 'mask',
  type: 'combine',
  inputs: [],
  glsl: `   float a = _luminance(_c1.rgb);
  return vec4(_c0.rgb*a, a*_c0.a);`
}, {
  name: 'luma',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'threshold',
    default: 0.5
  }, {
    type: 'float',
    name: 'tolerance',
    default: 0.1
  }],
  glsl: `   float a = smoothstep(threshold-(tolerance+0.0000001), threshold+(tolerance+0.0000001), _luminance(_c0.rgb));
   return vec4(_c0.rgb*a, a);`
}, {
  name: 'thresh',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'threshold',
    default: 0.5
  }, {
    type: 'float',
    name: 'tolerance',
    default: 0.04
  }],
  glsl: `   return vec4(vec3(smoothstep(threshold-(tolerance+0.0000001), threshold+(tolerance+0.0000001), _luminance(_c0.rgb))), _c0.a);`
}, {
  name: 'color',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'r',
    default: 1
  }, {
    type: 'float',
    name: 'g',
    default: 1
  }, {
    type: 'float',
    name: 'b',
    default: 1
  }, {
    type: 'float',
    name: 'a',
    default: 1
  }],
  glsl: `   vec4 c = vec4(r, g, b, a);
   vec4 pos = step(0.0, c); // detect whether negative
   // if > 0, return r * _c0
   // if < 0 return (1.0-r) * _c0
   return vec4(mix((1.0-_c0)*abs(c), c*_c0, pos));`
}, {
  name: 'saturate',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 2
  }],
  glsl: `   const vec3 W = vec3(0.2125, 0.7154, 0.0721);
   vec3 intensity = vec3(dot(_c0.rgb, W));
   return vec4(mix(intensity, _c0.rgb, amount), _c0.a);`
}, {
  name: 'hue',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'hue',
    default: 0.4
  }],
  glsl: `   vec3 c = _rgbToHsv(_c0.rgb);
   c.r += hue;
   //  c.r = fract(c.r);
   return vec4(_hsvToRgb(c), _c0.a);`
}, {
  name: 'colorama',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 0.005
  }],
  glsl: `   vec3 c = _rgbToHsv(_c0.rgb);
   c += vec3(amount);
   c = _hsvToRgb(c);
   c = fract(c);
   return vec4(c, _c0.a);`
}, {
  name: 'prev',
  type: 'src',
  inputs: [],
  glsl: `   return texture2D(prevBuffer, fract(_st));`
}, {
  name: 'sum',
  type: 'color',
  inputs: [{
    type: 'vec4',
    name: 'scale',
    default: 1
  }],
  glsl: `   vec4 v = _c0 * s;
   return v.r + v.g + v.b + v.a;
   }
   float sum(vec2 _st, vec4 s) { // vec4 is not a typo, because argument type is not overloaded
   vec2 v = _st.xy * s.xy;
   return v.x + v.y;`
}, {
  name: 'r',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'scale',
    default: 1
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   return vec4(_c0.r * scale + offset);`
}, {
  name: 'g',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'scale',
    default: 1
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   return vec4(_c0.g * scale + offset);`
}, {
  name: 'b',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'scale',
    default: 1
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   return vec4(_c0.b * scale + offset);`
}, {
  name: 'a',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'scale',
    default: 1
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   return vec4(_c0.a * scale + offset);`
}];
exports.default = _default;

},{}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
// functions that are only used within other functions
var _default = exports.default = {
  _luminance: {
    type: 'util',
    glsl: `float _luminance(vec3 rgb){
      const vec3 W = vec3(0.2125, 0.7154, 0.0721);
      return dot(rgb, W);
    }`
  },
  _noise: {
    type: 'util',
    glsl: `
    //	Simplex 3D Noise
    //	by Ian McEwan, Ashima Arts
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float _noise(vec3 v){
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    //  x0 = x0 - 0. + 0.0 * C
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
    i = mod(i, 289.0 );
    vec4 p = permute( permute( permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
    float n_ = 1.0/7.0; // N=7
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

  //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

  // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }
    `
  },
  _rgbToHsv: {
    type: 'util',
    glsl: `vec3 _rgbToHsv(vec3 c){
            vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
            vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
            vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

            float d = q.x - min(q.w, q.y);
            float e = 1.0e-10;
            return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }`
  },
  _hsvToRgb: {
    type: 'util',
    glsl: `vec3 _hsvToRgb(vec3 c){
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }`
  }
};

},{}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _webcam = _interopRequireDefault(require("./lib/webcam.js"));
var _screenmedia = _interopRequireDefault(require("./lib/screenmedia.js"));
var _index = require("./webgl/index.js");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
class HydraSource {
  constructor({
    gl,
    width,
    height,
    pb,
    label = ""
  }) {
    this.label = label;
    this.gl = gl;
    this.src = null;
    this.dynamic = true;
    this.width = width;
    this.height = height;
    this.tex = new _index.Texture(gl, {
      width: 1,
      height: 1,
      format: 'rgba',
      mag: 'nearest',
      min: 'nearest'
    });
    this.pb = pb;
  }
  init(opts, params) {
    if ('src' in opts) {
      this.src = opts.src;
      const texParams = {
        format: 'rgba',
        mag: 'nearest',
        min: 'nearest',
        ...params
      };
      this.tex = new _index.Texture(this.gl, {
        ...texParams,
        data: this.src
      });
    }
    if ('dynamic' in opts) this.dynamic = opts.dynamic;
  }
  initCam(index, params) {
    const self = this;
    (0, _webcam.default)(index).then(response => {
      self.src = response.video;
      self.dynamic = true;
      const texParams = {
        format: 'rgba',
        mag: 'nearest',
        min: 'nearest',
        ...params
      };
      self.tex = new _index.Texture(self.gl, {
        ...texParams,
        data: self.src
      });
    }).catch(err => console.log('could not get camera', err));
  }
  initVideo(url = '', params) {
    // const self = this
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.autoplay = true;
    vid.loop = true;
    vid.muted = true; // mute in order to load without user interaction
    const onload = vid.addEventListener('loadeddata', () => {
      this.src = vid;
      vid.play();
      const texParams = {
        format: 'rgba',
        mag: 'nearest',
        min: 'nearest',
        ...params
      };
      this.tex = new _index.Texture(this.gl, {
        ...texParams,
        data: this.src
      });
      this.dynamic = true;
    });
    vid.src = url;
  }
  initImage(url = '', params) {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      this.src = img;
      this.dynamic = false;
      const texParams = {
        format: 'rgba',
        mag: 'nearest',
        min: 'nearest',
        ...params
      };
      this.tex = new _index.Texture(this.gl, {
        ...texParams,
        data: this.src
      });
    };
  }
  initStream(streamName, params) {
    //  console.log("initing stream!", streamName)
    let self = this;
    if (streamName && this.pb) {
      this.pb.initSource(streamName);
      this.pb.on('got video', function (nick, video) {
        if (nick === streamName) {
          self.src = video;
          self.dynamic = true;
          const texParams = {
            format: 'rgba',
            mag: 'nearest',
            min: 'nearest',
            ...params
          };
          self.tex = new _index.Texture(self.gl, {
            ...texParams,
            data: self.src
          });
        }
      });
    }
  }

  // index only relevant in atom-hydra + desktop apps
  initScreen(index = 0, params) {
    const self = this;
    (0, _screenmedia.default)().then(function (response) {
      self.src = response.video;
      const texParams = {
        format: 'rgba',
        mag: 'nearest',
        min: 'nearest',
        ...params
      };
      self.tex = new _index.Texture(self.gl, {
        ...texParams,
        data: self.src
      });
      self.dynamic = true;
      //  console.log("received screen input")
    }).catch(err => console.log('could not get screen', err));
  }

  // cache for the canvases, so we don't create them every time
  canvases = {};

  // Creates a canvas and returns the 2d context
  initCanvas(width = 1000, height = 1000) {
    if (this.canvases[this.label] == undefined) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext('2d');
      if (ctx != null) this.canvases[this.label] = ctx;
    }
    const ctx = this.canvases[this.label];
    const canvas = ctx.canvas;
    if (canvas.width !== width && canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    this.init({
      src: canvas
    });
    this.dynamic = true;
    return ctx;
  }
  resize(width, height) {
    this.width = width;
    this.height = height;
  }
  clear() {
    if (this.src && this.src.srcObject) {
      if (this.src.srcObject.getTracks) {
        this.src.srcObject.getTracks().forEach(track => track.stop());
      }
    }
    this.src = null;
    this.tex = new _index.Texture(this.gl, {
      width: 1,
      height: 1,
      format: 'rgba',
      mag: 'nearest',
      min: 'nearest'
    });
  }
  tick(time) {
    //  console.log(this.src, this.tex.width, this.tex.height)
    if (this.src && this.dynamic === true) {
      if (this.src.videoWidth && this.src.videoWidth !== this.tex.width) {
        console.log(this.src.videoWidth, this.src.videoHeight, this.tex.width, this.tex.height);
        this.tex.resize(this.src.videoWidth, this.src.videoHeight);
      }
      if (this.src.width && this.src.width !== this.tex.width) {
        this.tex.resize(this.src.width, this.src.height);
      }
      this.tex.subimage(this.src);
    }
  }
  getTexture() {
    return this.tex;
  }
}
var _default = exports.default = HydraSource;

},{"./lib/screenmedia.js":18,"./lib/webcam.js":20,"./webgl/index.js":26}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _output = _interopRequireDefault(require("./output.js"));
var _animationLoop = _interopRequireDefault(require("./lib/animation-loop.js"));
var _hydraSource = _interopRequireDefault(require("./hydra-source.js"));
var _mouse = _interopRequireDefault(require("./lib/mouse.js"));
var _audio = _interopRequireDefault(require("./lib/audio.js"));
var _videoRecorder = _interopRequireDefault(require("./lib/video-recorder.js"));
var _arrayUtils = _interopRequireDefault(require("./lib/array-utils.js"));
var _evalSandbox = _interopRequireDefault(require("./eval-sandbox.js"));
var _generatorFactory = _interopRequireDefault(require("./generator-factory.js"));
var _index = require("./webgl/index.js");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// import strudel from './lib/strudel.js'

// const window = global.window

const Mouse = (0, _mouse.default)();
// to do: add ability to pass in certain uniforms and transforms
class HydraRenderer {
  constructor({
    pb = null,
    width = 1280,
    height = 720,
    numSources = 4,
    numOutputs = 4,
    makeGlobal = true,
    autoLoop = true,
    detectAudio = true,
    enableStreamCapture = true,
    canvas,
    precision,
    extendTransforms = {} // add your own functions on init
  } = {}) {
    _arrayUtils.default.init();
    this.pb = pb;
    this.width = width;
    this.height = height;
    this.renderAll = false;
    this.detectAudio = detectAudio;
    this._initCanvas(canvas);

    //global.window.test = 'hi'
    // object that contains all properties that will be made available on the global context and during local evaluation
    this.synth = {
      time: 0,
      bpm: 30,
      width: this.width,
      height: this.height,
      fps: undefined,
      stats: {
        fps: 0
      },
      speed: 1,
      mouse: Mouse,
      render: this._render.bind(this),
      setResolution: this.setResolution.bind(this),
      update: dt => {},
      // user defined update function
      afterUpdate: dt => {},
      // user defined function run after update
      hush: this.hush.bind(this),
      tick: this.tick.bind(this)
    };
    if (makeGlobal) window.loadScript = this.loadScript;
    this.timeSinceLastUpdate = 0;
    this._time = 0; // for internal use, only to use for deciding when to render frames

    // only allow valid precision options
    let precisionOptions = ['lowp', 'mediump', 'highp'];
    if (precision && precisionOptions.includes(precision.toLowerCase())) {
      this.precision = precision.toLowerCase();
      //
      // if(!precisionValid){
      //   console.warn('[hydra-synth warning]\nConstructor was provided an invalid floating point precision value of "' + precision + '". Using default value of "mediump" instead.')
      // }
    } else {
      let isIOS = (/iPad|iPhone|iPod/.test(navigator.platform) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) && !window.MSStream;
      this.precision = isIOS ? 'highp' : 'mediump';
    }
    this.extendTransforms = extendTransforms;

    // boolean to store when to save screenshot
    this.saveFrame = false;

    // if stream capture is enabled, this object contains the capture stream
    this.captureStream = null;
    this.generator = undefined;
    this._initWebGL();
    this._initOutputs(numOutputs);
    this._initSources(numSources);
    this._generateGlslTransforms();
    this.synth.screencap = () => {
      this.saveFrame = true;
    };
    if (enableStreamCapture) {
      try {
        this.captureStream = this.canvas.captureStream(25);
        // to do: enable capture stream of specific sources and outputs
        this.synth.vidRecorder = new _videoRecorder.default(this.captureStream);
      } catch (e) {
        console.warn('[hydra-synth warning]\nnew MediaSource() is not currently supported on iOS.');
        console.error(e);
      }
    }
    if (detectAudio) this._initAudio();
    if (autoLoop) (0, _animationLoop.default)(this.tick.bind(this)).start();

    // final argument is properties that the user can set, all others are treated as read-only
    this.sandbox = new _evalSandbox.default(this.synth, makeGlobal, ['speed', 'update', 'afterUpdate', 'bpm', 'fps']);
  }
  eval(code) {
    this.sandbox.eval(code);
  }
  getScreenImage(callback) {
    this.imageCallback = callback;
    this.saveFrame = true;
  }
  hush() {
    this.s.forEach(source => {
      source.clear();
    });
    this.o.forEach(output => {
      this.synth.solid(0, 0, 0, 0).out(output);
    });
    this.synth.render(this.o[0]);
    // this.synth.update = (dt) => {}
    this.sandbox.set('update', dt => {});
    this.sandbox.set('afterUpdate', dt => {});
  }
  loadScript(url = "") {
    const p = new Promise((res, rej) => {
      var script = document.createElement("script");
      script.onload = function () {
        console.log(`loaded script ${url}`);
        res();
      };
      script.onerror = err => {
        console.log(`error loading script ${url}`, "log-error");
        res();
      };
      script.src = url;
      document.head.appendChild(script);
    });
    return p;
  }
  setResolution(width, height) {
    //  console.log(width, height)
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width; // is this necessary?
    this.height = height; // ?
    this.sandbox.set('width', width);
    this.sandbox.set('height', height);
    console.log(this.width);
    this.o.forEach(output => {
      output.resize(width, height);
    });
    this.s.forEach(source => {
      source.resize(width, height);
    });
    this.glContext.refresh();
    console.log(this.canvas.width);
  }
  canvasToImage(callback) {
    const a = document.createElement('a');
    a.style.display = 'none';
    let d = new Date();
    a.download = `hydra-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}.${d.getMinutes()}.${d.getSeconds()}.png`;
    document.body.appendChild(a);
    var self = this;
    this.canvas.toBlob(blob => {
      if (self.imageCallback) {
        self.imageCallback(blob);
        delete self.imageCallback;
      } else {
        a.href = URL.createObjectURL(blob);
        console.log(a.href);
        a.click();
      }
    }, 'image/png');
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(a.href);
    }, 300);
  }
  _initAudio() {
    const that = this;
    this.synth.a = new _audio.default({
      numBins: 4,
      parentEl: this.canvas.parentNode
      // changeListener: ({audio}) => {
      //   that.a = audio.bins.map((_, index) =>
      //     (scale = 1, offset = 0) => () => (audio.fft[index] * scale + offset)
      //   )
      //
      //   if (that.makeGlobal) {
      //     that.a.forEach((a, index) => {
      //       const aname = `a${index}`
      //       window[aname] = a
      //     })
      //   }
      // }
    });
  }

  // create main output canvas and add to screen
  _initCanvas(canvas) {
    if (canvas) {
      this.canvas = canvas;
      this.width = canvas.width;
      this.height = canvas.height;
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.imageRendering = 'pixelated';
      document.body.appendChild(this.canvas);
    }
  }
  _initWebGL() {
    // Initialize WebGL context
    this.glContext = new _index.WebGLContext(this.canvas, {
      pixelRatio: 1
    });
    this.gl = this.glContext.gl;

    // This clears the color buffer to black and the depth buffer to 1
    this.glContext.clear([0, 0, 0, 1]);

    // Create position buffer for fullscreen triangle
    this.positionBuffer = new _index.Buffer(this.gl, [[-2, 0], [0, -2], [2, 2]]);

    // Create renderAll command for rendering all 4 outputs in quad layout
    this.renderAll = new _index.Command(this.gl, {
      frag: `
      precision ${this.precision} float;
      varying vec2 uv;
      uniform sampler2D tex0;
      uniform sampler2D tex1;
      uniform sampler2D tex2;
      uniform sampler2D tex3;

      void main () {
        vec2 st = vec2(1.0 - uv.x, uv.y);
        st*= vec2(2);
        vec2 q = floor(st).xy*(vec2(2.0, 1.0));
        int quad = int(q.x) + int(q.y);
        st.x += step(1., mod(st.y,2.0));
        st.y += step(1., mod(st.x,2.0));
        st = fract(st);
        if(quad==0){
          gl_FragColor = texture2D(tex0, st);
        } else if(quad==1){
          gl_FragColor = texture2D(tex1, st);
        } else if (quad==2){
          gl_FragColor = texture2D(tex2, st);
        } else {
          gl_FragColor = texture2D(tex3, st);
        }

      }
      `,
      vert: `
      precision ${this.precision} float;
      attribute vec2 position;
      varying vec2 uv;

      void main () {
        uv = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
      }`,
      attributes: {
        position: this.positionBuffer
      },
      uniforms: {
        tex0: (0, _index.prop)('tex0'),
        tex1: (0, _index.prop)('tex1'),
        tex2: (0, _index.prop)('tex2'),
        tex3: (0, _index.prop)('tex3')
      },
      count: 3
    });

    // Create renderFbo command for rendering a single framebuffer to screen
    this.renderFbo = new _index.Command(this.gl, {
      frag: `
      precision ${this.precision} float;
      varying vec2 uv;
      uniform vec2 resolution;
      uniform sampler2D tex0;

      void main () {
        gl_FragColor = texture2D(tex0, vec2(1.0 - uv.x, uv.y));
      }
      `,
      vert: `
      precision ${this.precision} float;
      attribute vec2 position;
      varying vec2 uv;

      void main () {
        uv = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
      }`,
      attributes: {
        position: this.positionBuffer
      },
      uniforms: {
        tex0: (0, _index.prop)('tex0'),
        resolution: (0, _index.prop)('resolution')
      },
      count: 3
    });
  }
  _initOutputs(numOutputs) {
    const self = this;
    this.o = Array(numOutputs).fill().map((el, index) => {
      var o = new _output.default({
        gl: this.gl,
        width: this.width,
        height: this.height,
        precision: this.precision,
        label: `o${index}`
      });
      //  o.render()
      o.id = index;
      self.synth['o' + index] = o;
      return o;
    });

    // set default output
    this.output = this.o[0];
  }
  _initSources(numSources) {
    this.s = [];
    for (var i = 0; i < numSources; i++) {
      this.createSource(i);
    }
  }
  createSource(i) {
    let s = new _hydraSource.default({
      gl: this.gl,
      pb: this.pb,
      width: this.width,
      height: this.height,
      label: `s${i}`
    });
    this.synth['s' + this.s.length] = s;
    this.s.push(s);
    return s;
  }
  _generateGlslTransforms() {
    var self = this;
    this.generator = new _generatorFactory.default({
      defaultOutput: this.o[0],
      defaultUniforms: this.o[0].uniforms,
      extendTransforms: this.extendTransforms,
      changeListener: ({
        type,
        method,
        synth
      }) => {
        if (type === 'add') {
          self.synth[method] = synth.generators[method];
          if (self.sandbox) self.sandbox.add(method);
        } else if (type === 'remove') {
          // what to do here? dangerously deleting window methods
          //delete window[method]
        }
        //  }
      }
    });
    this.synth.setFunction = this.generator.setFunction.bind(this.generator);
  }
  _render(output) {
    if (output) {
      this.output = output;
      this.isRenderingAll = false;
    } else {
      this.isRenderingAll = true;
    }
  }

  // dt in ms
  tick(dt, uniforms) {
    try {
      this.sandbox.tick();
      if (this.detectAudio === true) this.synth.a.tick();
      //  let updateInterval = 1000/this.synth.fps // ms
      this.sandbox.set('time', this.synth.time += dt * 0.001 * this.synth.speed);
      this.timeSinceLastUpdate += dt;
      if (!this.synth.fps || this.timeSinceLastUpdate >= 1000 / this.synth.fps) {
        //  console.log(1000/this.timeSinceLastUpdate)
        this.synth.stats.fps = Math.ceil(1000 / this.timeSinceLastUpdate);
        if (this.synth.update) {
          try {
            this.synth.update(this.timeSinceLastUpdate);
          } catch (e) {
            console.log(e);
          }
        }
        //  console.log(this.synth.speed, this.synth.time)
        for (let i = 0; i < this.s.length; i++) {
          this.s[i].tick(this.synth.time);
        }
        //  console.log(this.canvas.width, this.canvas.height)
        const currentTime = this.synth.time;
        for (let i = 0; i < this.o.length; i++) {
          this.o[i].tick({
            time: currentTime,
            mouse: this.synth.mouse,
            bpm: this.synth.bpm,
            resolution: [this.canvas.width, this.canvas.height]
          });
        }
        if (this.isRenderingAll) {
          this.renderAll.execute({
            tex0: this.o[0].getCurrent(),
            tex1: this.o[1].getCurrent(),
            tex2: this.o[2].getCurrent(),
            tex3: this.o[3].getCurrent(),
            resolution: [this.canvas.width, this.canvas.height]
          });
        } else {
          this.renderFbo.execute({
            tex0: this.output.getCurrent(),
            resolution: [this.canvas.width, this.canvas.height]
          });
        }
        if (this.synth.afterUpdate) {
          try {
            this.synth.afterUpdate(this.timeSinceLastUpdate);
          } catch (e) {
            console.log(e);
          }
        }
        this.timeSinceLastUpdate = 0;
      }
      if (this.saveFrame === true) {
        this.canvasToImage();
        this.saveFrame = false;
      }
    } catch (e) {
      console.warn('Error during tick():', e);
    }
  }
}
var _default = exports.default = HydraRenderer;

},{"./eval-sandbox.js":1,"./generator-factory.js":4,"./hydra-source.js":8,"./lib/animation-loop.js":11,"./lib/array-utils.js":12,"./lib/audio.js":13,"./lib/mouse.js":16,"./lib/video-recorder.js":19,"./output.js":21,"./webgl/index.js":26}],10:[function(require,module,exports){
"use strict";

var _hydraSynth = _interopRequireDefault(require("./hydra-synth.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
//import ShaderGenerator = require('./shader-generator.js')
// alert('hi')
// export default Synth
module.exports = _hydraSynth.default;

},{"./hydra-synth.js":9}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createAnimationLoop = createAnimationLoop;
exports.default = _default;
// Replacement for the removed 'raf-loop' dependency.
// Usage: const loop = createAnimationLoop(cb); loop.start();
// Provides only start() and stop(), matching existing usage pattern.
function createAnimationLoop(cb) {
  let rafId = null;
  let lastTime = null;
  function frame(t) {
    if (rafId == null) return;
    const dt = lastTime == null ? 0 : t - lastTime;
    lastTime = t;
    try {
      cb(dt);
    } catch (e) {
      console.warn('animation loop error:', e);
    }
    rafId = requestAnimationFrame(frame);
  }
  return {
    start() {
      if (rafId != null) return;
      if (typeof requestAnimationFrame === 'undefined') return;
      lastTime = null;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
        lastTime = null;
      }
    }
  };
}
function _default(cb) {
  return createAnimationLoop(cb);
}

},{}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _easingFunctions = _interopRequireDefault(require("./easing-functions.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// WIP utils for working with arrays
// Possibly should be integrated with lfo extension, etc.
// to do: transform time rather than array values, similar to working with coordinates in hydra

var map = (num, in_min, in_max, out_min, out_max) => {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
};

// The '%' operator is a remainder operator, and Javascript lacks a dedicated
// modulo operator. This function is an implementation of the operation
// copied-n-pasted from
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder#description
var modulo = (n, d) => {
  return (n % d + d) % d;
};
var _default = exports.default = {
  init: () => {
    Array.prototype.fast = function (speed = 1) {
      this._speed = speed;
      return this;
    };
    Array.prototype.smooth = function (smooth = 1) {
      this._smooth = smooth;
      return this;
    };
    Array.prototype.ease = function (ease = 'linear') {
      if (typeof ease == 'function') {
        this._smooth = 1;
        this._ease = ease;
      } else if (_easingFunctions.default[ease]) {
        this._smooth = 1;
        this._ease = _easingFunctions.default[ease];
      }
      return this;
    };
    Array.prototype.offset = function (offset = 0.5) {
      this._offset = offset % 1.0;
      return this;
    };

    // Array.prototype.bounce = function() {
    //   this.modifiers.bounce = true
    //   return this
    // }

    Array.prototype.fit = function (low = 0, high = 1) {
      let lowest = Math.min(...this);
      let highest = Math.max(...this);
      var newArr = this.map(num => map(num, lowest, highest, low, high));
      newArr._speed = this._speed;
      newArr._smooth = this._smooth;
      newArr._ease = this._ease;
      return newArr;
    };
  },
  getValue: (arr = []) => ({
    time,
    bpm
  }) => {
    let speed = arr._speed ? arr._speed : 1;
    let smooth = arr._smooth ? arr._smooth : 0;
    let index = time * speed * (bpm / 60) + (arr._offset || 0);
    if (smooth !== 0) {
      let ease = arr._ease ? arr._ease : _easingFunctions.default['linear'];
      let _index = index - smooth / 2;
      // Compute the first value used for the interpolation: wrap _index inside the range [0, arr.length), then round the resulting value towards 0.
      // Note that, during the first seconds Hydra is running, _index may assume a negative value.
      // If we wrapped _index inside the range [0, arr.length) using the regular remainder operator, the result would be negative.
      // Passing a negative index to an array returns undefined, which ultimately causes a number of graphical glitches.
      // We need to use the modulo operation to prevent this.
      let currValue = arr[Math.floor(modulo(_index, arr.length))];
      // Compute the second value used for the interpolation, in a similar fashion to 'currValue'.
      // The above reasoning about the choice of the modulo operation applies for 'nextValue', too.
      let nextValue = arr[Math.floor(modulo(_index + 1, arr.length))];
      // Compute the time parameter for the interpolation.
      // Note that, during the first seconds Hydra is running, _index may assume a negative value.
      // Assuming 'smooth' is positive, if we wrapped _index in the range [0, 1) using the regular remainder operator, t would become negative as a result.
      // This would cause the final interpolation to assume values inconsistent with the later ones.
      // E.g. [0, 1].smooth() should always generate values between 0 and 1, but the initial values would be negative.
      // We need to use the modulo operation to prevent this.
      let t = Math.min(modulo(_index, 1) / smooth, 1);
      return ease(t) * (nextValue - currValue) + currValue;
    } else {
      const val = arr[Math.floor(index % arr.length)];
      return arr[Math.floor(index % arr.length)];
    }
  }
};

},{"./easing-functions.js":14}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
// Audio analysis now uses native Web Audio API (instead of Meyda)

class Audio {
  // Bark scale band edges (Hz) - 24 bands (similar to Meyda's numberOfBarkBands)
  static BARK_EDGES = [20, 100, 200, 300, 400, 510, 630, 770, 920, 1080, 1270, 1480, 1720, 2000, 2320, 2700, 3150, 3700, 4400, 5300, 6400, 7700, 9500, 12000, 15500];
  static BARK_BANDS = 24;

  // Gain correction to be as close as Meyda's analysis
  static GAIN_CORRECTION = 1;
  constructor({
    numBins = 4,
    cutoff = 2,
    smooth = 0.4,
    max = 15,
    scale = 10,
    isDrawing = false,
    parentEl = document.body
  }) {
    this.vol = 0;
    this.scale = scale;
    this.max = max;
    this.cutoff = cutoff;
    this.smooth = smooth;
    this.setBins(numBins);

    // beat detection from: https://github.com/therewasaguy/p5-music-viz/blob/gh-pages/demos/01d_beat_detect_amplitude/sketch.js
    this.beat = {
      holdFrames: 20,
      threshold: 40,
      _cutoff: 0,
      // adaptive based on sound state
      decay: 0.98,
      _framesSinceBeat: 0 // keeps track of frames
    };
    this.onBeat = () => {
      //  console.log("beat")
    };
    this.canvas = document.createElement('canvas');
    this.canvas.width = 100;
    this.canvas.height = 80;
    this.canvas.style.width = "100px";
    this.canvas.style.height = "80px";
    this.canvas.style.position = 'absolute';
    this.canvas.style.right = '0px';
    this.canvas.style.bottom = '0px';
    parentEl.appendChild(this.canvas);
    this.isDrawing = isDrawing;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.fillStyle = "#DFFFFF";
    this.ctx.strokeStyle = "#0ff";
    this.ctx.lineWidth = 0.5;

    // Native audio analysis replacement for Meyda loudness features
    this.analyser = null;
    this.freqData = null;
    this.linear = null;
    this.specific = new Float32Array(Audio.BARK_BANDS);
    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      }).then(stream => {
        this.stream = stream;
        this.context = new AudioContext();
        const audio_stream = this.context.createMediaStreamSource(stream);
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0; // keep custom smoothing implemented below
        this.freqData = new Float32Array(this.analyser.frequencyBinCount);
        this.linear = new Float32Array(this.analyser.frequencyBinCount);
        audio_stream.connect(this.analyser);
      }).catch(err => console.log('ERROR', err));
    }
  }
  detectBeat(level) {
    //console.log(level,   this.beat._cutoff)
    if (level > this.beat._cutoff && level > this.beat.threshold) {
      this.onBeat();
      this.beat._cutoff = level * 1.2;
      this.beat._framesSinceBeat = 0;
    } else {
      if (this.beat._framesSinceBeat <= this.beat.holdFrames) {
        this.beat._framesSinceBeat++;
      } else {
        this.beat._cutoff *= this.beat.decay;
        this.beat._cutoff = Math.max(this.beat._cutoff, this.beat.threshold);
      }
    }
  }
  tick() {
    if (!this.analyser) return;

    // Acquire current spectrum in decibels
    this.analyser.getFloatFrequencyData(this.freqData);

    // Convert dB to linear amplitude and unnormalize by FFT size (to match Meyda's raw FFT magnitudes)
    const fftSize = this.analyser.fftSize;
    const binCount = this.freqData.length;
    for (let i = 0; i < binCount; i++) {
      this.linear[i] = Math.pow(10, this.freqData[i] / 20) * fftSize;
    }
    const nyquist = this.context.sampleRate / 2;
    const binWidth = nyquist / binCount;

    // Reset specific loudness accumulation (reuse array)
    this.specific.fill(0);

    // Accumulate frequency bins into bark bands
    let barkBandIndex = 0;
    for (let i = 0; i < binCount; i++) {
      const freq = i * binWidth;
      // Advance bark band index when frequency exceeds current band edge
      while (barkBandIndex < Audio.BARK_EDGES.length - 2 && freq >= Audio.BARK_EDGES[barkBandIndex + 1]) {
        barkBandIndex++;
      }
      this.specific[barkBandIndex] += this.linear[i];
    }

    // Apply Meyda's power law for perceptual loudness scaling
    for (let i = 0; i < this.specific.length; i++) {
      this.specific[i] = Math.pow(this.specific[i], 0.23) * Audio.GAIN_CORRECTION;
    }

    // Calculate total volume
    let vol = 0;
    for (let i = 0; i < this.specific.length; i++) {
      vol += this.specific[i];
    }
    this.vol = vol;
    this.detectBeat(this.vol);

    // Reduce specific array to bins with smoothing (combined single loop, no allocations)
    const spacing = Math.floor(this.specific.length / this.bins.length);
    for (let index = 0; index < this.bins.length; index++) {
      // Sum bark bands for this bin
      let sum = 0;
      const start = index * spacing;
      const end = (index + 1) * spacing;
      for (let i = start; i < end; i++) {
        sum += this.specific[i];
      }
      // Apply smoothing using previous bin value
      const prevBin = this.bins[index];
      const smoothed = sum * (1.0 - this.settings[index].smooth) + prevBin * this.settings[index].smooth;
      this.bins[index] = smoothed;
      // Calculate FFT output
      this.fft[index] = Math.max(0, (smoothed - this.settings[index].cutoff) / this.settings[index].scale);
    }
    if (this.isDrawing) this.draw();
  }
  setCutoff(cutoff) {
    this.cutoff = cutoff;
    this.settings = this.settings.map(el => {
      el.cutoff = cutoff;
      return el;
    });
  }
  setSmooth(smooth) {
    this.smooth = smooth;
    this.settings = this.settings.map(el => {
      el.smooth = smooth;
      return el;
    });
  }
  setBins(numBins) {
    this.bins = Array(numBins).fill(0);
    this.fft = Array(numBins).fill(0);
    this.settings = Array(numBins).fill(0).map(() => ({
      cutoff: this.cutoff,
      scale: this.scale,
      smooth: this.smooth
    }));
    // to do: what to do in non-global mode?
    this.bins.forEach((bin, index) => {
      window['a' + index] = (scale = 1, offset = 0) => () => a.fft[index] * scale + offset;
    });
    //  console.log(this.settings)
  }
  setScale(scale) {
    this.scale = scale;
    this.settings = this.settings.map(el => {
      el.scale = scale;
      return el;
    });
  }
  setMax(max) {
    this.max = max;
    console.log('set max is deprecated');
  }
  hide() {
    this.isDrawing = false;
    this.canvas.style.display = 'none';
  }
  show() {
    this.isDrawing = true;
    this.canvas.style.display = 'block';
  }
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    var spacing = this.canvas.width / this.bins.length;
    var scale = this.canvas.height / (this.max * 2);
    //  console.log(this.bins)
    this.bins.forEach((bin, index) => {
      var height = bin * scale;
      this.ctx.fillRect(index * spacing, this.canvas.height - height, spacing, height);

      //   console.log(this.settings[index])
      var y = this.canvas.height - scale * this.settings[index].cutoff;
      this.ctx.beginPath();
      this.ctx.moveTo(index * spacing, y);
      this.ctx.lineTo((index + 1) * spacing, y);
      this.ctx.stroke();
      var yMax = this.canvas.height - scale * (this.settings[index].scale + this.settings[index].cutoff);
      this.ctx.beginPath();
      this.ctx.moveTo(index * spacing, yMax);
      this.ctx.lineTo((index + 1) * spacing, yMax);
      this.ctx.stroke();
    });

    /*var y = this.canvas.height - scale*this.cutoff
    this.ctx.beginPath()
    this.ctx.moveTo(0, y)
    this.ctx.lineTo(this.canvas.width, y)
    this.ctx.stroke()
    var yMax = this.canvas.height - scale*this.max
    this.ctx.beginPath()
    this.ctx.moveTo(0, yMax)
    this.ctx.lineTo(this.canvas.width, yMax)
    this.ctx.stroke()*/
  }
}
var _default = exports.default = Audio;

},{}],14:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
// from https://gist.github.com/gre/1650294
var _default = exports.default = {
  // no easing, no acceleration
  linear: function (t) {
    return t;
  },
  // accelerating from zero velocity
  easeInQuad: function (t) {
    return t * t;
  },
  // decelerating to zero velocity
  easeOutQuad: function (t) {
    return t * (2 - t);
  },
  // acceleration until halfway, then deceleration
  easeInOutQuad: function (t) {
    return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  // accelerating from zero velocity
  easeInCubic: function (t) {
    return t * t * t;
  },
  // decelerating to zero velocity
  easeOutCubic: function (t) {
    return --t * t * t + 1;
  },
  // acceleration until halfway, then deceleration
  easeInOutCubic: function (t) {
    return t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  },
  // accelerating from zero velocity
  easeInQuart: function (t) {
    return t * t * t * t;
  },
  // decelerating to zero velocity
  easeOutQuart: function (t) {
    return 1 - --t * t * t * t;
  },
  // acceleration until halfway, then deceleration
  easeInOutQuart: function (t) {
    return t < .5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t;
  },
  // accelerating from zero velocity
  easeInQuint: function (t) {
    return t * t * t * t * t;
  },
  // decelerating to zero velocity
  easeOutQuint: function (t) {
    return 1 + --t * t * t * t * t;
  },
  // acceleration until halfway, then deceleration
  easeInOutQuint: function (t) {
    return t < .5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;
  },
  // sin shape
  sin: function (t) {
    return (1 + Math.sin(Math.PI * t - Math.PI / 2)) / 2;
  }
};

},{}],15:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
// https://github.com/mikolalysenko/mouse-event

const mouse = {};
function mouseButtons(ev) {
  if (typeof ev === 'object') {
    if ('buttons' in ev) {
      return ev.buttons;
    } else if ('which' in ev) {
      var b = ev.which;
      if (b === 2) {
        return 4;
      } else if (b === 3) {
        return 2;
      } else if (b > 0) {
        return 1 << b - 1;
      }
    } else if ('button' in ev) {
      var b = ev.button;
      if (b === 1) {
        return 4;
      } else if (b === 2) {
        return 2;
      } else if (b >= 0) {
        return 1 << b;
      }
    }
  }
  return 0;
}
mouse.buttons = mouseButtons;
function mouseElement(ev) {
  return ev.target || ev.srcElement || window;
}
mouse.element = mouseElement;
function mouseRelativeX(ev) {
  if (typeof ev === 'object') {
    if ('pageX' in ev) {
      return ev.pageX;
    }
  }
  return 0;
}
mouse.x = mouseRelativeX;
function mouseRelativeY(ev) {
  if (typeof ev === 'object') {
    if ('pageY' in ev) {
      return ev.pageY;
    }
  }
  return 0;
}
mouse.y = mouseRelativeY;
var _default = exports.default = mouse;

},{}],16:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _mouseEvent = _interopRequireDefault(require("./mouse-event.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// based on https://github.com/mikolalysenko/mouse-change
var _default = exports.default = mouseListen;
function mouseListen(element, callback) {
  if (!callback) {
    callback = element;
    element = window;
  }
  var buttonState = 0;
  var x = 0;
  var y = 0;
  var mods = {
    shift: false,
    alt: false,
    control: false,
    meta: false
  };
  var attached = false;
  function updateMods(ev) {
    var changed = false;
    if ('altKey' in ev) {
      changed = changed || ev.altKey !== mods.alt;
      mods.alt = !!ev.altKey;
    }
    if ('shiftKey' in ev) {
      changed = changed || ev.shiftKey !== mods.shift;
      mods.shift = !!ev.shiftKey;
    }
    if ('ctrlKey' in ev) {
      changed = changed || ev.ctrlKey !== mods.control;
      mods.control = !!ev.ctrlKey;
    }
    if ('metaKey' in ev) {
      changed = changed || ev.metaKey !== mods.meta;
      mods.meta = !!ev.metaKey;
    }
    return changed;
  }
  function handleEvent(nextButtons, ev) {
    var nextX = _mouseEvent.default.x(ev);
    var nextY = _mouseEvent.default.y(ev);
    if ('buttons' in ev) {
      nextButtons = ev.buttons | 0;
    }
    if (nextButtons !== buttonState || nextX !== x || nextY !== y || updateMods(ev)) {
      buttonState = nextButtons | 0;
      x = nextX || 0;
      y = nextY || 0;
      callback && callback(buttonState, x, y, mods);
    }
  }
  function clearState(ev) {
    handleEvent(0, ev);
  }
  function handleBlur() {
    if (buttonState || x || y || mods.shift || mods.alt || mods.meta || mods.control) {
      x = y = 0;
      buttonState = 0;
      mods.shift = mods.alt = mods.control = mods.meta = false;
      callback && callback(0, 0, 0, mods);
    }
  }
  function handleMods(ev) {
    if (updateMods(ev)) {
      callback && callback(buttonState, x, y, mods);
    }
  }
  function handleMouseMove(ev) {
    if (_mouseEvent.default.buttons(ev) === 0) {
      handleEvent(0, ev);
    } else {
      handleEvent(buttonState, ev);
    }
  }
  function handleMouseDown(ev) {
    handleEvent(buttonState | _mouseEvent.default.buttons(ev), ev);
  }
  function handleMouseUp(ev) {
    handleEvent(buttonState & ~_mouseEvent.default.buttons(ev), ev);
  }
  function attachListeners() {
    if (attached) {
      return;
    }
    attached = true;
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('mouseleave', clearState);
    element.addEventListener('mouseenter', clearState);
    element.addEventListener('mouseout', clearState);
    element.addEventListener('mouseover', clearState);
    element.addEventListener('blur', handleBlur);
    element.addEventListener('keyup', handleMods);
    element.addEventListener('keydown', handleMods);
    element.addEventListener('keypress', handleMods);
    if (element !== window) {
      window.addEventListener('blur', handleBlur);
      window.addEventListener('keyup', handleMods);
      window.addEventListener('keydown', handleMods);
      window.addEventListener('keypress', handleMods);
    }
  }
  function detachListeners() {
    if (!attached) {
      return;
    }
    attached = false;
    element.removeEventListener('mousemove', handleMouseMove);
    element.removeEventListener('mousedown', handleMouseDown);
    element.removeEventListener('mouseup', handleMouseUp);
    element.removeEventListener('mouseleave', clearState);
    element.removeEventListener('mouseenter', clearState);
    element.removeEventListener('mouseout', clearState);
    element.removeEventListener('mouseover', clearState);
    element.removeEventListener('blur', handleBlur);
    element.removeEventListener('keyup', handleMods);
    element.removeEventListener('keydown', handleMods);
    element.removeEventListener('keypress', handleMods);
    if (element !== window) {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('keyup', handleMods);
      window.removeEventListener('keydown', handleMods);
      window.removeEventListener('keypress', handleMods);
    }
  }

  // Attach listeners
  attachListeners();
  var result = {
    element: element
  };
  Object.defineProperties(result, {
    enabled: {
      get: function () {
        return attached;
      },
      set: function (f) {
        if (f) {
          attachListeners();
        } else {
          detachListeners();
        }
      },
      enumerable: true
    },
    buttons: {
      get: function () {
        return buttonState;
      },
      enumerable: true
    },
    x: {
      get: function () {
        return x;
      },
      enumerable: true
    },
    y: {
      get: function () {
        return y;
      },
      enumerable: true
    },
    mods: {
      get: function () {
        return mods;
      },
      enumerable: true
    }
  });
  return result;
}

},{"./mouse-event.js":15}],17:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
// attempt custom evaluation sandbox for hydra functions
// for now, just avoids polluting the global namespace
// should probably be replaced with an abstract syntax tree
var _default = parent => {
  var initialCode = ``;
  var sandbox = createSandbox(initialCode);
  var addToContext = (name, object) => {
    initialCode += `
      var ${name} = ${object}
    `;
    sandbox = createSandbox(initialCode);
  };
  return {
    addToContext: addToContext,
    eval: code => sandbox.eval(code)
  };
  function createSandbox(initial) {
    globalThis.eval(initial);
    // optional params
    var localEval = function (code) {
      globalThis.eval(code);
    };

    // API/data for end-user
    return {
      eval: localEval
    };
  }
};
exports.default = _default;

},{}],18:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
function _default(options) {
  return new Promise(function (resolve, reject) {
    //  async function startCapture(displayMediaOptions) {
    navigator.mediaDevices.getDisplayMedia(options).then(stream => {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.addEventListener('loadedmetadata', () => {
        video.play();
        resolve({
          video: video
        });
      });
    }).catch(err => reject(err));
  });
}

},{}],19:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
class VideoRecorder {
  constructor(stream) {
    this.mediaSource = new MediaSource();
    this.stream = stream;

    // testing using a recording as input
    this.output = document.createElement('video');
    this.output.autoplay = true;
    this.output.loop = true;
    let self = this;
    this.mediaSource.addEventListener('sourceopen', () => {
      console.log('MediaSource opened');
      self.sourceBuffer = self.mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
      console.log('Source buffer: ', sourceBuffer);
    });
  }
  start() {
    //  let options = {mimeType: 'video/webm'};

    //   let options = {mimeType: 'video/webm;codecs=h264'};
    let options = {
      mimeType: 'video/webm;codecs=vp9'
    };
    this.recordedBlobs = [];
    try {
      this.mediaRecorder = new MediaRecorder(this.stream, options);
    } catch (e0) {
      console.log('Unable to create MediaRecorder with options Object: ', e0);
      try {
        options = {
          mimeType: 'video/webm,codecs=vp9'
        };
        this.mediaRecorder = new MediaRecorder(this.stream, options);
      } catch (e1) {
        console.log('Unable to create MediaRecorder with options Object: ', e1);
        try {
          options = 'video/vp8'; // Chrome 47
          this.mediaRecorder = new MediaRecorder(this.stream, options);
        } catch (e2) {
          alert('MediaRecorder is not supported by this browser.\n\n' + 'Try Firefox 29 or later, or Chrome 47 or later, ' + 'with Enable experimental Web Platform features enabled from chrome://flags.');
          console.error('Exception while creating MediaRecorder:', e2);
          return;
        }
      }
    }
    console.log('Created MediaRecorder', this.mediaRecorder, 'with options', options);
    this.mediaRecorder.onstop = this._handleStop.bind(this);
    this.mediaRecorder.ondataavailable = this._handleDataAvailable.bind(this);
    this.mediaRecorder.start(100); // collect 100ms of data
    console.log('MediaRecorder started', this.mediaRecorder);
  }
  stop() {
    this.mediaRecorder.stop();
  }
  _handleStop() {
    //const superBuffer = new Blob(recordedBlobs, {type: 'video/webm'})
    // const blob = new Blob(this.recordedBlobs, {type: 'video/webm;codecs=h264'})
    const blob = new Blob(this.recordedBlobs, {
      type: this.mediaRecorder.mimeType
    });
    const url = window.URL.createObjectURL(blob);
    this.output.src = url;
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    let d = new Date();
    a.download = `hydra-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}.${d.getMinutes()}.${d.getSeconds()}.webm`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 300);
  }
  _handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
      this.recordedBlobs.push(event.data);
    }
  }
}
var _default = exports.default = VideoRecorder;

},{}],20:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
//const enumerateDevices = require('enumerate-devices')

function _default(deviceId) {
  return navigator.mediaDevices.enumerateDevices().then(devices => devices.filter(devices => devices.kind === 'videoinput')).then(cameras => {
    let constraints = {
      audio: false,
      video: true
    };
    if (cameras[deviceId]) {
      constraints['video'] = {
        deviceId: {
          exact: cameras[deviceId].deviceId
        }
      };
    }
    //  console.log(cameras)
    return window.navigator.mediaDevices.getUserMedia(constraints);
  }).then(stream => {
    const video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    //  video.src = window.URL.createObjectURL(stream)
    video.srcObject = stream;
    return new Promise((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => {
        video.play().then(() => resolve({
          video: video
        }));
      });
    });
  }).catch(console.log.bind(console));
}

},{}],21:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _index = require("./webgl/index.js");
//const transforms = require('./glsl-transforms.js')

var Output = function ({
  gl,
  precision,
  label = "",
  width,
  height
}) {
  this.gl = gl;
  this.precision = precision;
  this.label = label;
  this.positionBuffer = new _index.Buffer(gl, [[-2, 0], [0, -2], [2, 2]]);
  this.draw = () => {};
  this.init();
  this.pingPongIndex = 0;

  // for each output, create two fbos for pingponging
  this.fbos = Array(2).fill().map(() => new _index.Framebuffer(gl, {
    width: width,
    height: height,
    format: 'rgba',
    mag: 'nearest'
  }));

  // array containing render passes
  //  this.passes = []
};
Output.prototype.resize = function (width, height) {
  this.fbos.forEach(fbo => {
    fbo.resize(width, height);
  });
  //  console.log(this)
};
Output.prototype.getCurrent = function () {
  return this.fbos[this.pingPongIndex];
};
Output.prototype.getTexture = function () {
  var index = this.pingPongIndex ? 0 : 1;
  return this.fbos[index];
};
Output.prototype.init = function () {
  //  console.log('clearing')
  this.transformIndex = 0;
  this.fragHeader = `
  precision ${this.precision} float;

  uniform float time;
  varying vec2 uv;
  `;
  this.fragBody = ``;
  this.vert = `
  precision ${this.precision} float;
  attribute vec2 position;
  varying vec2 uv;

  void main () {
    uv = position;
    gl_Position = vec4(2.0 * position - 1.0, 0, 1);
  }`;
  this.attributes = {
    position: this.positionBuffer
  };
  this.uniforms = {
    time: (0, _index.prop)('time'),
    resolution: (0, _index.prop)('resolution')
  };
  this.frag = `
       ${this.fragHeader}

      void main () {
        vec4 c = vec4(0, 0, 0, 0);
        vec2 st = uv;
        ${this.fragBody}
        gl_FragColor = c;
      }
  `;
  return this;
};
Output.prototype.render = function (passes) {
  let pass = passes[0];
  //console.log('pass', pass, this.pingPongIndex)
  var self = this;
  var uniforms = Object.assign(pass.uniforms, {
    prevBuffer: () => {
      //var index = this.pingPongIndex ? 0 : 1
      //   var index = self.pingPong[(passIndex+1)%2]
      //  console.log('ping pong', self.pingPongIndex)
      return self.fbos[self.pingPongIndex];
    }
  });
  self.draw = new _index.Command(self.gl, {
    frag: pass.frag,
    vert: self.vert,
    attributes: self.attributes,
    uniforms: uniforms,
    count: 3,
    framebuffer: () => {
      self.pingPongIndex = self.pingPongIndex ? 0 : 1;
      return self.fbos[self.pingPongIndex];
    }
  });
};
Output.prototype.tick = function (props) {
  //  console.log(props)
  if (this.draw && this.draw.execute) {
    this.draw.execute(props);
  }
};
var _default = exports.default = Output;

},{"./webgl/index.js":26}],22:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Buffer = void 0;
// Vertex buffer management
class Buffer {
  constructor(gl, data, usage = null) {
    this.gl = gl;
    this.buffer = gl.createBuffer();
    this.usage = usage || gl.STATIC_DRAW;
    if (data) {
      this.setData(data);
    }
  }
  setData(data) {
    const gl = this.gl;

    // Convert data to Float32Array if needed
    let bufferData = data;
    if (Array.isArray(data)) {
      // Flatten nested arrays if needed
      const flattened = this.flattenArray(data);
      bufferData = new Float32Array(flattened);
    } else if (!(data instanceof Float32Array)) {
      bufferData = new Float32Array(data);
    }
    this.bind();
    gl.bufferData(gl.ARRAY_BUFFER, bufferData, this.usage);
    this.length = bufferData.length;
  }
  flattenArray(arr) {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      if (Array.isArray(arr[i])) {
        result.push(...arr[i]);
      } else {
        result.push(arr[i]);
      }
    }
    return result;
  }
  bind() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
  }
  unbind() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }
  destroy() {
    if (this.buffer) {
      this.gl.deleteBuffer(this.buffer);
      this.buffer = null;
    }
  }
}
exports.Buffer = Buffer;

},{}],23:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Command = void 0;
exports.prop = prop;
var _shader = require("./shader.js");
// Draw command abstraction (regl-like interface)

class Command {
  constructor(gl, config) {
    this.gl = gl;
    this.config = config;
    this.warnedErrors = new Set(); // Track errors we've already logged

    // Create shader if vertex and fragment sources provided
    if (config.vert && config.frag) {
      this.shader = new _shader.Shader(gl, config.vert, config.frag);
    }

    // Store configuration
    this.attributes = config.attributes || {};
    this.uniforms = config.uniforms || {};
    this.count = config.count || 3;
    this.primitive = this.parsePrimitive(config.primitive || 'triangles');
    this.framebuffer = config.framebuffer || null;
    this.viewport = config.viewport || null;
  }
  parsePrimitive(primitive) {
    const gl = this.gl;
    const primitiveMap = {
      'points': gl.POINTS,
      'lines': gl.LINES,
      'line strip': gl.LINE_STRIP,
      'line loop': gl.LINE_LOOP,
      'triangles': gl.TRIANGLES,
      'triangle strip': gl.TRIANGLE_STRIP,
      'triangle fan': gl.TRIANGLE_FAN
    };
    return primitiveMap[primitive] || gl.TRIANGLES;
  }
  execute(props = {}) {
    const gl = this.gl;

    // Use shader
    if (this.shader) {
      this.shader.use();
    }

    // Bind framebuffer
    const fbo = this.resolveValue(this.framebuffer, props);
    if (fbo) {
      fbo.bind();
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // Set viewport
    const viewport = this.resolveValue(this.viewport, props);
    if (viewport) {
      gl.viewport(viewport.x || 0, viewport.y || 0, viewport.width, viewport.height);
    }

    // Set attributes
    let textureUnit = 0;
    for (const name in this.attributes) {
      const attrConfig = this.attributes[name];
      const value = this.resolveValue(attrConfig, props);

      // Check if value is a Buffer object
      if (value && typeof value.bind === 'function' && !value.texture) {
        const size = attrConfig.size || 2;
        this.shader.setAttribute(name, value, size);
      }
    }

    // Set uniforms
    for (const name in this.uniforms) {
      const uniformConfig = this.uniforms[name];
      let value = this.resolveValue(uniformConfig, props);

      // Handle texture binding
      if (value && value.bind && value.texture) {
        // It's a Texture object
        value.bind(textureUnit);
        value = textureUnit;
        textureUnit++;
      } else if (value && value.color && value.color.bind) {
        // It's a Framebuffer object (use its color texture)
        value.color.bind(textureUnit);
        value = textureUnit;
        textureUnit++;
      }
      if (this.shader) {
        this.shader.setUniform(name, value);
      }
    }

    // Draw
    const count = this.resolveValue(this.count, props);
    gl.drawArrays(this.primitive, 0, count);

    // Unbind framebuffer
    if (fbo) {
      fbo.unbind();
    }
  }
  resolveValue(value, props) {
    if (typeof value === 'function') {
      try {
        // Uniform functions have signature (context, props, batchId)
        const context = {}; // Minimal context object
        const batchId = 0; // Batch ID for draw calls

        const result = value(context, props, batchId);

        // If the result is also a function, call it again with props
        // This handles getValue() which returns a function expecting {time, bpm}
        if (typeof result === 'function') {
          return result(props);
        }
        return result;
      } catch (e) {
        // Only warn once per error to avoid console spam
        const errorKey = e.message + value.toString().substring(0, 50);
        if (!this.warnedErrors.has(errorKey)) {
          console.warn('Error resolving uniform:', e.message);
          this.warnedErrors.add(errorKey);
        }
        // Return a safe default instead of throwing
        return 0;
      }
    } else if (value && value._isProp) {
      // Handle regl.prop() pattern
      return props[value.name];
    }
    return value;
  }
  destroy() {
    if (this.shader) {
      this.shader.destroy();
      this.shader = null;
    }
  }
}

// Helper to create regl.prop() equivalent
exports.Command = Command;
function prop(name) {
  return {
    _isProp: true,
    name: name
  };
}

},{"./shader.js":27}],24:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WebGLContext = void 0;
// WebGL context management
class WebGLContext {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.pixelRatio = options.pixelRatio || 1;

    // Create WebGL context
    const contextOptions = {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      antialias: false,
      ...options.contextAttributes
    };
    this.gl = canvas.getContext('webgl', contextOptions) || canvas.getContext('experimental-webgl', contextOptions);
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    // Handle context loss
    this.handleContextLost = this.handleContextLost.bind(this);
    this.handleContextRestored = this.handleContextRestored.bind(this);
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    // Set initial state
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.CULL_FACE);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  }
  handleContextLost(event) {
    event.preventDefault();
    console.warn('WebGL context lost');
  }
  handleContextRestored() {
    console.log('WebGL context restored');
  }
  clear(color = [0, 0, 0, 1]) {
    const gl = this.gl;
    gl.clearColor(color[0], color[1], color[2], color[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  viewport(x, y, width, height) {
    this.gl.viewport(x, y, width, height);
  }
  refresh() {
    // Force WebGL to refresh state
    this.gl.flush();
  }
  destroy() {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
  }
}
exports.WebGLContext = WebGLContext;

},{}],25:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Framebuffer = void 0;
var _texture = require("./texture.js");
// Framebuffer management

class Framebuffer {
  constructor(gl, options = {}) {
    this.gl = gl;
    this.framebuffer = gl.createFramebuffer();
    this.width = options.width || 1;
    this.height = options.height || 1;

    // Create color attachment texture
    const textureOptions = {
      width: this.width,
      height: this.height,
      format: options.format || 'rgba',
      type: options.type || 'uint8',
      min: options.min || 'nearest',
      mag: options.mag || 'nearest',
      wrapS: options.wrapS || 'clamp',
      wrapT: options.wrapT || 'clamp'
    };
    this.color = new _texture.Texture(gl, textureOptions);

    // Attach texture to framebuffer
    this.bind();
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.color.texture, 0);

    // Check framebuffer status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer is not complete:', this.getStatusString(status));
    }
    this.unbind();
  }
  getStatusString(status) {
    const gl = this.gl;
    const statusMap = {
      [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
      [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
      [gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS]: 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS',
      [gl.FRAMEBUFFER_UNSUPPORTED]: 'FRAMEBUFFER_UNSUPPORTED'
    };
    return statusMap[status] || 'UNKNOWN_ERROR';
  }
  bind() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
  }
  unbind() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }
  resize(width, height) {
    if (this.width === width && this.height === height) {
      return;
    }
    this.width = width;
    this.height = height;
    this.color.resize(width, height);

    // Re-attach texture to framebuffer
    this.bind();
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.color.texture, 0);
    this.unbind();
  }
  destroy() {
    if (this.color) {
      this.color.destroy();
      this.color = null;
    }
    if (this.framebuffer) {
      this.gl.deleteFramebuffer(this.framebuffer);
      this.framebuffer = null;
    }
  }
}
exports.Framebuffer = Framebuffer;

},{"./texture.js":28}],26:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "Buffer", {
  enumerable: true,
  get: function () {
    return _buffer.Buffer;
  }
});
Object.defineProperty(exports, "Command", {
  enumerable: true,
  get: function () {
    return _command.Command;
  }
});
Object.defineProperty(exports, "Framebuffer", {
  enumerable: true,
  get: function () {
    return _framebuffer.Framebuffer;
  }
});
Object.defineProperty(exports, "Shader", {
  enumerable: true,
  get: function () {
    return _shader.Shader;
  }
});
Object.defineProperty(exports, "Texture", {
  enumerable: true,
  get: function () {
    return _texture.Texture;
  }
});
Object.defineProperty(exports, "WebGLContext", {
  enumerable: true,
  get: function () {
    return _context.WebGLContext;
  }
});
Object.defineProperty(exports, "prop", {
  enumerable: true,
  get: function () {
    return _command.prop;
  }
});
var _context = require("./context.js");
var _shader = require("./shader.js");
var _buffer = require("./buffer.js");
var _texture = require("./texture.js");
var _framebuffer = require("./framebuffer.js");
var _command = require("./command.js");

},{"./buffer.js":22,"./command.js":23,"./context.js":24,"./framebuffer.js":25,"./shader.js":27,"./texture.js":28}],27:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Shader = void 0;
// Shader compilation and program management
class Shader {
  constructor(gl, vertexSource, fragmentSource) {
    this.gl = gl;
    this.program = null;
    this.uniforms = {};
    this.attributes = {};
    this.warnedAttributes = new Set(); // Track which attributes we've already warned about

    this.compile(vertexSource, fragmentSource);
  }
  compile(vertexSource, fragmentSource) {
    const gl = this.gl;

    // Compile vertex shader
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    if (!vertexShader) {
      throw new Error('Failed to compile vertex shader');
    }

    // Compile fragment shader
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!fragmentShader) {
      gl.deleteShader(vertexShader);
      throw new Error('Failed to compile fragment shader');
    }

    // Link program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    // Check for link errors
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(this.program);
      gl.deleteProgram(this.program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error('Failed to link shader program: ' + info);
    }

    // Clean up shaders (no longer needed after linking)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    // Cache uniform and attribute locations
    this.cacheLocations();
  }
  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      const typeName = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
      console.error(`Failed to compile ${typeName} shader:`, info);
      console.error('Shader source:', source);
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  cacheLocations() {
    const gl = this.gl;
    const program = this.program;

    // Cache uniform locations
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) {
        const location = gl.getUniformLocation(program, info.name);
        this.uniforms[info.name] = {
          location,
          type: info.type,
          size: info.size
        };
      }
    }

    // Cache attribute locations
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
      const info = gl.getActiveAttrib(program, i);
      if (info) {
        const location = gl.getAttribLocation(program, info.name);
        this.attributes[info.name] = {
          location,
          type: info.type,
          size: info.size
        };
      }
    }
  }
  use() {
    this.gl.useProgram(this.program);
  }
  setUniform(name, value) {
    const gl = this.gl;
    const uniform = this.uniforms[name];
    if (!uniform) {
      // Silently ignore missing uniforms (they may be optimized out)
      return;
    }
    const loc = uniform.location;

    // Handle different uniform types
    switch (uniform.type) {
      case gl.FLOAT:
        gl.uniform1f(loc, value);
        break;
      case gl.FLOAT_VEC2:
        gl.uniform2fv(loc, value);
        break;
      case gl.FLOAT_VEC3:
        gl.uniform3fv(loc, value);
        break;
      case gl.FLOAT_VEC4:
        gl.uniform4fv(loc, value);
        break;
      case gl.INT:
      case gl.BOOL:
        gl.uniform1i(loc, value);
        break;
      case gl.INT_VEC2:
      case gl.BOOL_VEC2:
        gl.uniform2iv(loc, value);
        break;
      case gl.INT_VEC3:
      case gl.BOOL_VEC3:
        gl.uniform3iv(loc, value);
        break;
      case gl.INT_VEC4:
      case gl.BOOL_VEC4:
        gl.uniform4iv(loc, value);
        break;
      case gl.SAMPLER_2D:
      case gl.SAMPLER_CUBE:
        gl.uniform1i(loc, value);
        break;
      case gl.FLOAT_MAT2:
        gl.uniformMatrix2fv(loc, false, value);
        break;
      case gl.FLOAT_MAT3:
        gl.uniformMatrix3fv(loc, false, value);
        break;
      case gl.FLOAT_MAT4:
        gl.uniformMatrix4fv(loc, false, value);
        break;
      default:
        console.warn(`Unsupported uniform type: ${uniform.type}`);
    }
  }
  setAttribute(name, buffer, size = 3, type = null, normalized = false, stride = 0, offset = 0) {
    const gl = this.gl;
    const attribute = this.attributes[name];
    if (!attribute) {
      // Only warn once per attribute name to avoid console spam
      if (!this.warnedAttributes.has(name)) {
        console.warn(`Attribute '${name}' not found in shader`);
        this.warnedAttributes.add(name);
      }
      return;
    }
    buffer.bind();
    gl.enableVertexAttribArray(attribute.location);
    gl.vertexAttribPointer(attribute.location, size, type || gl.FLOAT, normalized, stride, offset);
  }
  destroy() {
    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
  }
}
exports.Shader = Shader;

},{}],28:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Texture = void 0;
// Texture management
class Texture {
  constructor(gl, options = {}) {
    this.gl = gl;
    this.texture = gl.createTexture();
    this.width = options.width || 1;
    this.height = options.height || 1;
    this.format = options.format || 'rgba';
    this.type = options.type || 'uint8';

    // Texture parameters
    this.minFilter = this.parseFilter(options.min || 'nearest');
    this.magFilter = this.parseFilter(options.mag || 'nearest');
    this.wrapS = this.parseWrap(options.wrapS || 'clamp');
    this.wrapT = this.parseWrap(options.wrapT || 'clamp');
    this.bind();
    this.setupTexture(options.data);
    this.setParameters();
  }
  parseFilter(filter) {
    const gl = this.gl;
    const filterMap = {
      'nearest': gl.NEAREST,
      'linear': gl.LINEAR,
      'mipmap': gl.LINEAR_MIPMAP_LINEAR
    };
    return filterMap[filter] || gl.NEAREST;
  }
  parseWrap(wrap) {
    const gl = this.gl;
    const wrapMap = {
      'clamp': gl.CLAMP_TO_EDGE,
      'repeat': gl.REPEAT,
      'mirror': gl.MIRRORED_REPEAT
    };
    return wrapMap[wrap] || gl.CLAMP_TO_EDGE;
  }
  getGLFormat() {
    const gl = this.gl;
    const formatMap = {
      'alpha': gl.ALPHA,
      'luminance': gl.LUMINANCE,
      'luminance alpha': gl.LUMINANCE_ALPHA,
      'rgb': gl.RGB,
      'rgba': gl.RGBA
    };
    return formatMap[this.format] || gl.RGBA;
  }
  getGLType() {
    const gl = this.gl;
    const typeMap = {
      'uint8': gl.UNSIGNED_BYTE,
      'uint16': gl.UNSIGNED_SHORT,
      'float': gl.FLOAT
    };
    return typeMap[this.type] || gl.UNSIGNED_BYTE;
  }
  setupTexture(data = null) {
    const gl = this.gl;
    const glFormat = this.getGLFormat();
    const glType = this.getGLType();
    if (data) {
      // If data is provided (image, video, canvas, etc.)
      if (data instanceof HTMLImageElement || data instanceof HTMLVideoElement || data instanceof HTMLCanvasElement || data instanceof ImageData) {
        gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, glFormat, glType, data);
        this.width = data.width || data.videoWidth || 1;
        this.height = data.height || data.videoHeight || 1;
      } else if (ArrayBuffer.isView(data)) {
        // Typed array data
        gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, glFormat, glType, data);
      }
    } else {
      // Create empty texture
      gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, glFormat, glType, null);
    }
  }
  setParameters() {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrapT);
  }
  bind(unit = 0) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }
  unbind() {
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }
  resize(width, height) {
    if (this.width === width && this.height === height) {
      return;
    }
    this.width = width;
    this.height = height;
    this.bind();
    const gl = this.gl;
    const glFormat = this.getGLFormat();
    const glType = this.getGLType();
    gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, width, height, 0, glFormat, glType, null);
  }
  subimage(data, x = 0, y = 0) {
    this.bind();
    const gl = this.gl;
    const glFormat = this.getGLFormat();
    const glType = this.getGLType();
    if (data instanceof HTMLImageElement || data instanceof HTMLVideoElement || data instanceof HTMLCanvasElement || data instanceof ImageData) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, glFormat, glType, data);
    } else if (ArrayBuffer.isView(data)) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, this.width, this.height, glFormat, glType, data);
    }
  }
  destroy() {
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
  }
}
exports.Texture = Texture;

},{}]},{},[10])(10)
});
