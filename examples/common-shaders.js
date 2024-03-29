import {tiny} from '../tiny-graphics.js';
// Pull these names into this module's scope for convenience:
const {Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4, Shape, Shader, Component} = tiny;

const defs = {};

export {tiny, defs};

const Basic_Shader = defs.Basic_Shader =
  class Basic_Shader extends Shader {
      // Basic_Shader is nearly the simplest way to subclass Shader, which stores and manages a GPU program.
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          // update_GPU():  Define how to synchronize our JavaScript's variables to the GPU's:
          const [P, C, M] = [uniforms.projection_transform, uniforms.camera_inverse, model_transform],
                PCM       = P.times (C).times (M);
          context.uniformMatrix4fv (gpu_addresses.projection_camera_model_transform, false,
                                    Matrix.flatten_2D_to_1D (PCM.transposed ()));
      }
      shared_glsl_code () {           // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
          return `precision mediump float;
                  varying vec4 VERTEX_COLOR;
      `;
      }
      vertex_glsl_code () {          // ********* VERTEX SHADER *********
          return this.shared_glsl_code () + `
        attribute vec4 color;
        attribute vec3 position;                            // Position is expressed in object coordinates.
        uniform mat4 projection_camera_model_transform;

        void main() { 
          gl_Position = projection_camera_model_transform * vec4( position, 1.0 );      // Move vertex to final space.
          VERTEX_COLOR = color;                                 // Use the hard-coded color of the vertex.
        }`;
      }
      fragment_glsl_code () {         // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        void main() {                                                   
          gl_FragColor = VERTEX_COLOR;    // Directly use per-vertex colors for interpolation.
        }`;
      }
  };


const Funny_Shader = defs.Funny_Shader =
  class Funny_Shader extends Shader {
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          const [P, C, M] = [uniforms.projection_transform, uniforms.camera_inverse, model_transform],
                PCM       = P.times (C).times (M);
          context.uniformMatrix4fv (gpu_addresses.projection_camera_model_transform, false,
                                    Matrix.flatten_2D_to_1D (PCM.transposed ()));
          context.uniform1f (gpu_addresses.animation_time, uniforms.animation_time / 1000);
      }
      shared_glsl_code () {
          return `precision mediump float;
                  varying vec2 f_tex_coord;
      `;
      }
      vertex_glsl_code () {
          return this.shared_glsl_code () + `
        attribute vec3 position;                            // Position is expressed in object coordinates.
        attribute vec2 texture_coord;
        uniform mat4 projection_camera_model_transform;

        void main() {
          gl_Position = projection_camera_model_transform * vec4( position, 1.0 );  // Move vertex to final space
          f_tex_coord = texture_coord;                 // Supply the original texture coords for interpolation.
        }`;
      }
      fragment_glsl_code () {
          return this.shared_glsl_code () + `
        uniform float animation_time;
        void main() { 
          float a = animation_time, u = f_tex_coord.x, v = f_tex_coord.y;
          
          // To color in all pixels, use an arbitrary math function based only on time and UV texture coordinates.
          gl_FragColor = vec4(                                    
            2.0 * u * sin(17.0 * u ) + 3.0 * v * sin(11.0 * v ) + 1.0 * sin(13.0 * a),
            3.0 * u * sin(18.0 * u ) + 4.0 * v * sin(12.0 * v ) + 2.0 * sin(14.0 * a),
            4.0 * u * sin(19.0 * u ) + 5.0 * v * sin(13.0 * v ) + 3.0 * sin(15.0 * a),
            5.0 * u * sin(20.0 * u ) + 6.0 * v * sin(14.0 * v ) + 4.0 * sin(16.0 * a));
        }`;
      }
  };


const Phong_Shader = defs.Phong_Shader =
  class Phong_Shader extends Shader {
      constructor (num_lights = 2) {
          super ();
          this.num_lights = num_lights;
      }
      shared_glsl_code () {          // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
          return ` 
        precision mediump float;
        const int N_LIGHTS = ` + this.num_lights + `;
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;

        varying vec3 N, vertex_worldspace;
                                             // ***** PHONG SHADING HAPPENS HERE: *****
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ) {
            vec3 E = normalize( camera_center - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++) {
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz -
                                               light_positions_or_vectors[i].w * vertex_worldspace;
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );
                
                  // Compute diffuse and specular components of Phong Reflection Model.
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );     // Use Blinn's "halfway vector" method.
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );


                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                          + light_colors[i].xyz * specularity * specular;

                result += attenuation * light_contribution;
              }
            return result;
          } `;
      }
      vertex_glsl_code () {           // ********* VERTEX SHADER *********
          return this.shared_glsl_code () + `
        attribute vec3 position, normal;                            // Position is expressed in object coordinates.

        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main() {                                                                
            gl_Position = projection_camera_model_transform * vec4( position, 1.0 );     // Move vertex to final space.
                                            // The final normal vector in screen space.
            N = normalize( mat3( model_transform ) * normal / squared_scale);

            vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
          } `;
      }
      fragment_glsl_code () {          // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        void main() {                          
                                           // Compute an initial (ambient) color:
            gl_FragColor = vec4( shape_color.xyz * ambient, shape_color.w );
                                           // Compute the final color with contributions from lights:
            gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
          } `;
      }
      static light_source (position, color, size) {
          return {position, color, attenuation: 1 / size};
      }
      send_material (gl, gpu, material) {
          gl.uniform4fv (gpu.shape_color, material.color);
          gl.uniform1f (gpu.ambient, material.ambient);
          gl.uniform1f (gpu.diffusivity, material.diffusivity);
          gl.uniform1f (gpu.specularity, material.specularity);
          gl.uniform1f (gpu.smoothness, material.smoothness);
      }
      send_uniforms (gl, gpu, uniforms, model_transform) {
          const O = vec4 (0, 0, 0, 1), camera_center = uniforms.camera_transform.times (O).to3 ();
          gl.uniform3fv (gpu.camera_center, camera_center);

          // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
          const squared_scale = model_transform.reduce (
            (acc, r) => { return acc.plus (vec4 (...r).times_pairwise (r)); }, vec4 (0, 0, 0, 0)).to3 ();
          gl.uniform3fv (gpu.squared_scale, squared_scale);

          // Send the current matrices to the shader as a single pre-computed final matrix, the product.
          const PCM = uniforms.projection_transform.times (uniforms.camera_inverse).times (model_transform);
          gl.uniformMatrix4fv (gpu.model_transform, false, Matrix.flatten_2D_to_1D (model_transform.transposed ()));
          gl.uniformMatrix4fv (gpu.projection_camera_model_transform, false,
                               Matrix.flatten_2D_to_1D (PCM.transposed ()));

          if ( !uniforms.lights || !uniforms.lights.length)
              return;         // Lights omitted, ambient only

          const light_positions_flattened = [], light_colors_flattened = [];
          for (var i = 0; i < 4 * uniforms.lights.length; i++) {
              light_positions_flattened.push (uniforms.lights[ Math.floor (i / 4) ].position[ i % 4 ]);
              light_colors_flattened.push (uniforms.lights[ Math.floor (i / 4) ].color[ i % 4 ]);
          }
          gl.uniform4fv (gpu.light_positions_or_vectors, light_positions_flattened);
          gl.uniform4fv (gpu.light_colors, light_colors_flattened);
          gl.uniform1fv (gpu.light_attenuation_factors, uniforms.lights.map (l => l.attenuation));
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          const defaults    = {color: color (0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
          let full_material = Object.assign (defaults, material);

          this.send_material (context, gpu_addresses, full_material);
          this.send_uniforms (context, gpu_addresses, uniforms, model_transform);
      }
  };


const Textured_Phong = defs.Textured_Phong =
  class Textured_Phong extends Phong_Shader {
      vertex_glsl_code () {         // ********* VERTEX SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        attribute vec3 position, normal;                            // Position is expressed in object coordinates.
        attribute vec2 texture_coord;

        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main() {
            gl_Position = projection_camera_model_transform * vec4( position, 1.0 );     // Move vertex to final space.
                                              // The final normal vector in screen space.
            N = normalize( mat3( model_transform ) * normal / squared_scale);

            vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                                              // Turn the per-vertex texture coordinate into an interpolated variable.
            f_tex_coord = texture_coord;
          } `;
      }
      fragment_glsl_code () {        // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        uniform sampler2D texture;

        void main() {
            vec4 tex_color = texture2D( texture, f_tex_coord );       // Sample texture image in the correct place.
            if( tex_color.w < .01 ) discard;
                                                                     // Compute an initial (ambient) color:
            gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w );
                                                                     // Compute the final color with contributions from lights:
            gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
          } `;
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          super.update_GPU (context, gpu_addresses, uniforms, model_transform, material);

          if (material.texture && material.texture.ready) {
              // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
              context.uniform1i (gpu_addresses.texture, 0);
              // For this draw, use the texture image from correct the GPU buffer:
              material.texture.activate (context, 0);
          }
      }
  };
  const Snow_Shader = defs.Snow_Shader =
  class Snow_Shader extends Phong_Shader {
      vertex_glsl_code () {         // ********* VERTEX SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        attribute vec3 position, normal;                            // Position is expressed in object coordinates.
        attribute vec2 texture_coord;

        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main() {
            gl_Position = projection_camera_model_transform * vec4( position, 1.0 );     // Move vertex to final space.
                                              // The final normal vector in screen space.
            N = normalize( mat3( model_transform ) * normal / squared_scale);

            vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                                              // Turn the per-vertex texture coordinate into an interpolated variable.
            f_tex_coord = texture_coord;
            // if(length(vertex_worldspace - vec3(0,5,0)) > 5.0)
            //   gl_FragDepth = 1.0;
          } `;
      }
      fragment_glsl_code () {        // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        uniform sampler2D texture;

        void main() {
            vec4 tex_color = texture2D( texture, f_tex_coord );       // Sample texture image in the correct place.
            if( tex_color.w < .01 ) discard;
                                                                     // Compute an initial (ambient) color:
            gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w );
                                                                     // Compute the final color with contributions from lights:
            gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
            // if(length(vertex_worldspace - vec3(0,5,0)) > 5.0) {
            //   gl_FragColor.w = 0.0;
            // }
              
          } `;
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          super.update_GPU (context, gpu_addresses, uniforms, model_transform, material);

          if (material.texture && material.texture.ready) {
              // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
              context.uniform1i (gpu_addresses.texture, 0);
              // For this draw, use the texture image from correct the GPU buffer:
              material.texture.activate (context, 0);
          }
      }
  };

  const Reflective = defs.Reflective =
  class Reflective extends Phong_Shader {
      vertex_glsl_code () {         // ********* VERTEX SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        attribute vec3 position, normal;                            // Position is expressed in object coordinates.
        attribute vec2 texture_coord;

        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main() {
            gl_Position = projection_camera_model_transform * vec4( position, 1.0 );     // Move vertex to final space.
                                              // The final normal vector in screen space.

            N = normalize( mat3( model_transform ) * normal);

            vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                                              // Turn the per-vertex texture coordinate into an interpolated variable.
            f_tex_coord = texture_coord;

          } `;
      }
      fragment_glsl_code () {        // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        uniform samplerCube texture;

        void main() {
            // vec4 tex_color = texture2D( texture, f_tex_coord );       // Sample texture image in the correct place.
            // if( tex_color.w < .01 ) discard;
            //                                                          // Compute an initial (ambient) color:
            // gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w );
            //                                                          // Compute the final color with contributions from lights:
            // gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );



            vec3 eyeToSurfaceDir = normalize(vertex_worldspace-camera_center);
            vec3 front_normal = N;
            vec3 direction = reflect(front_normal,eyeToSurfaceDir)*vec3(1,-1,-1);

            
            vec3 reflection = textureCube(texture, direction).xyz;
 

            float ratio = 1.00 / 1.0;
            vec3 R = refract(N,eyeToSurfaceDir, ratio);
            vec3 refraction = textureCube(texture, R*vec3(1,1,1)).xyz;
            // if(vertex_worldspace.y > 3.0)
            //   refraction = vec3(0,0,0);

            gl_FragColor.xyz = reflection *vec3(0.2,0.2,0.2)+refraction*vec3(.7,.7,.7);
              
            gl_FragColor.w = .2;
            // if(gl_FrontFacing)
            //   gl_FragColor.w = 0.0;


          } `;
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          super.update_GPU (context, gpu_addresses, uniforms, model_transform, material);

          if (material.texture && material.texture.ready) {
              // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
              context.uniform1i (gpu_addresses.texture, 0);
              // For this draw, use the texture image from correct the GPU buffer:
              material.texture.activate (context, 0);
          }
      }
  };

  const Water = defs.Water =
  class Water extends Phong_Shader {
      vertex_glsl_code () {         // ********* VERTEX SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        attribute vec3 position, normal;                            // Position is expressed in object coordinates.
        attribute vec2 texture_coord;

        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main() {
            gl_Position = projection_camera_model_transform * vec4( position, 1.0 );     // Move vertex to final space.
                                              // The final normal vector in screen space.

            N = normalize( mat3( model_transform ) * normal);

            vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                                              // Turn the per-vertex texture coordinate into an interpolated variable.
            f_tex_coord = texture_coord;

          } `;
      }
      fragment_glsl_code () {        // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        uniform samplerCube texture;

        void main() {
            // vec4 tex_color = texture2D( texture, f_tex_coord );       // Sample texture image in the correct place.
            // if( tex_color.w < .01 ) discard;
            //                                                          // Compute an initial (ambient) color:
            // gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w );
            //                                                          // Compute the final color with contributions from lights:
            // gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );



            vec3 eyeToSurfaceDir = normalize(vertex_worldspace-camera_center);
            vec3 front_normal = N;
            vec3 direction = reflect(front_normal,eyeToSurfaceDir)*vec3(1,-1,-1);

            
            vec3 reflection = textureCube(texture, direction).xyz;
 

            float ratio = 1.00 / 1.0;
            vec3 R = refract(N,eyeToSurfaceDir, ratio);
            vec3 refraction = textureCube(texture, R*vec3(1,1,1)).xyz;
            // if(vertex_worldspace.y > 3.0)
            //   refraction = vec3(0,0,0);

            gl_FragColor.xyz = reflection *vec3(0.0,0.3,0.4)+refraction*vec3(.7,.7,.7);
              
            gl_FragColor.w = 0.7;
            // if(gl_FrontFacing)
            //   gl_FragColor.w = 0.0;


          } `;
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          super.update_GPU (context, gpu_addresses, uniforms, model_transform, material);

          if (material.texture && material.texture.ready) {
              // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
              context.uniform1i (gpu_addresses.texture, 0);
              // For this draw, use the texture image from correct the GPU buffer:
              material.texture.activate (context, 0);
          }
      }
  };
  
  const Cube_Map = defs.Cube_Map =
  class Cube_Map extends Shader {
      vertex_glsl_code () {         // ********* VERTEX SHADER *********
          return  `
          attribute vec3 position;
          varying vec4 v_position;
          void main() {
            v_position = vec4(position,1);
            v_position.z = 1.0;
            gl_Position = v_position;
          } `;
      }
      fragment_glsl_code () {        // ********* FRAGMENT SHADER *********
          return `
          precision mediump float;
 
          uniform samplerCube texture;
          uniform mat4 viewDirectionProjectionInverse;
           
          varying vec4 v_position;
          void main() {
            vec4 t = viewDirectionProjectionInverse * v_position * vec4(1,-1,1,1);
            gl_FragColor = textureCube(texture, normalize(t.xyz / t.w));
          } `;
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          //super.update_GPU (context, gpu_addresses, uniforms, model_transform, material);

          if (material.texture && material.texture.ready) {
              // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
              context.uniform1i (gpu_addresses.texture, 0);
              // For this draw, use the texture image from correct the GPU buffer:
              material.texture.activate (context, 0);
          }

          // Send the current matrices to the shader as a single pre-computed final matrix, the product.
          var viewMatrix = uniforms.camera_transform.copy();
          viewMatrix[0][3] = 0;
          viewMatrix[1][3] = 0;
          viewMatrix[2][3] = 0;

          var viewDirectionProjectionMatrix = 
              uniforms.projection_transform.times(viewMatrix);
          var viewDirectionProjectionInverseMatrix = 
          Matrix.flatten_2D_to_1D(Mat4.inverse(viewDirectionProjectionMatrix).transposed());
          
          // Set the uniforms
          context.uniformMatrix4fv(
              gpu_addresses.viewDirectionProjectionInverse, false, 
              viewDirectionProjectionInverseMatrix);
          context.depthFunc(context.LEQUAL);
      }
  };

  const Clouds = defs.Clouds =
  class Clouds extends Phong_Shader {
      vertex_glsl_code () {         // ********* VERTEX SHADER *********
          return  `
          attribute vec3 position;
          varying vec4 v_position;
          void main() {
            v_position = vec4(position,1);
            v_position.z = 0.97;
            gl_Position = v_position;
          } `;
      }
      fragment_glsl_code () {        // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () +`
          mat3 m = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
          float hash(float n) {
            return fract(sin(n) * 43758.5453);
          }
        
          float noise(vec3 x) {
            vec3 p = floor(x);
            vec3 f = fract(x);
        
            f = f * f * (3.0 - 2.0 * f);
        
            float n = p.x + p.y * 57.0 + 113.0 * p.z;
        
            float res = mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                                mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
                            mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                                mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
            return res;
          }
        
          float fbm(vec3 p) {
            float f = 0.0;
            f += 0.5000 * noise(p); p = m * p * 2.02;
            f += 0.2500 * noise(p); p = m * p * 2.03;
            //f += 0.12500 * noise(p); p = m * p * 2.01;
            //f += 0.06250 * noise(p);
            return f;
          }

          precision mediump float;
 
          uniform samplerCube texture;
          uniform mat4 viewDirectionProjectionInverse;
          uniform mat4 projection_camera_model_transform;
           
          varying vec4 v_position;


          vec3 uCloudSize = vec3(0.4, 1.0, 0.4);
          vec3 uSunPosition = vec3(1.0,2.0,1.0);
          vec3 uCloudColor = vec3(1.0,1.0,1.0);
          vec3 uSkyColor = vec3(0.0,0.0,0.1);
          float uCloudSteps = 48.0;
          float uShadowSteps = 8.0;
          float uCloudLength = 16.0;
          float uShadowLength = 2.0;
          vec2 uResolution = vec2(1080,600);
          // varying float uFocalLength;
          // bool uRegress;

          float cloudDepth(vec3 position) {
            float ellipse = 1.0-length((position-vec3(0.0,6.0,0.0)) * uCloudSize*0.7);
            float cloud = ellipse + fbm(position);
        
            return min(max(0.0, cloud), 1.0);
          }

          vec4 cloudMarch(float jitter, vec3 position, vec3 ray) {
            float stepLength = uCloudLength / uCloudSteps;
            float shadowStepLength = uShadowLength / uShadowSteps;
        
            vec3 lightDirection = normalize(uSunPosition);
            vec3 cloudPosition = position + ray * jitter * stepLength;
        
            vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
        
            for (float i = 0.0; i < 100.0; i++) {
              if (color.a < 0.1) break;
        
              float depth = cloudDepth(cloudPosition);
              if (depth > 0.001) {
                vec3 lightPosition = cloudPosition + lightDirection * jitter * shadowStepLength;
        
                float shadow = 0.0;
                for (float s = 0.0; s < 8.0; s++) {
                  lightPosition += lightDirection * shadowStepLength;
                  shadow += cloudDepth(lightPosition);
                }
                shadow = exp((-shadow / uShadowSteps) * 3.0);
        
                float density = clamp((depth / uCloudSteps) * 20.0, 0.0, 1.0);
                color.rgb += vec3(shadow * density) * uCloudColor * color.a;
                color.a *= 1.0 - density;
        
                color.rgb += density * uSkyColor * color.a;
                //color.rgb = vec3(1.0,1.0,1.0);
              }
        
              cloudPosition += ray * stepLength;
            }
        
            return color;
          }


          mat3 lookAt(vec3 target, vec3 origin) {
            vec3 cw = normalize(origin - target);
            vec3 cu = normalize(cross(cw, origin));
            vec3 cv = normalize(cross(cu, cw));
            return mat3(cu, cv, cw);
          }


          void main() {
            vec2 pixel = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
            //float jitter = uRegress ? hash(pixel.x + pixel.y * 50.0 + uTime) : 0.0;

            mat3 camera = lookAt(camera_center, vec3(0.0, 1.0, 0.0));
            //vec3 ray = (projection_camera_model_transform * normalize(vec4(pixel, 2.0, 1.0))).xyz;
            vec3 ray = camera * normalize(vec3(pixel, 2.0));

            vec4 color = cloudMarch(0.0, camera_center, ray);
            //gl_FragColor = vec4(color.rgb + uSkyColor * color.a, 1.0);
            gl_FragColor = vec4(color.rgb, 1.0-color.a);
          } `;
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          super.update_GPU (context, gpu_addresses, uniforms, model_transform, material);
      }
  };


const Fake_Bump_Map = defs.Fake_Bump_Map =
  class Fake_Bump_Map extends Textured_Phong {
      fragment_glsl_code () {                            // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        uniform sampler2D texture;

        void main()  {        
            vec4 tex_color = texture2D( texture, f_tex_coord );       // Sample texture image in the correct place.
            if( tex_color.w < .01 ) discard;
                            
            // This time, slightly disturb normals based on sampling the same image that was used for texturing.
            vec3 bumped_N  = N + tex_color.rgb - .5*vec3(1,1,1);
            gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w );
            gl_FragColor.xyz += phong_model_lights( normalize( bumped_N ), vertex_worldspace );
          } `;
      }
  };
