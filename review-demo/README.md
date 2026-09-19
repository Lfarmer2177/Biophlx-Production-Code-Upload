# BIOPHLX customer preview

The full-* files render the actual app screens in a browser using simulated auth, AWS, Bluetooth, and checkout. No real payments or band connections occur. Keep generated stage/build files out of Git. The other review scripts are local exploratory artifacts.

The preview needs the app dependencies plus react-dom, react-native-web and the esbuild CLI. Run prepare-demo.cjs to create build-args.json, then invoke esbuild with those arguments (as an argument array). Build-Demo.ps1 is the Windows launcher. full-serve.cjs serves the generated output from the parent workspace. Production App.js does not import these mocks.
