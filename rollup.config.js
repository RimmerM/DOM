import replace from "rollup-plugin-replace";

const isProduction = process.env.NODE_ENV === "production";

const plugins = [
  replace({ "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV) }),
];

export default {
  entry: "./tmp/index.js",
  targets: [
    { dest: "./bin/dom-es6.js", format: "es" },
    { dest: "./bin/dom.js", format: "iife", moduleName: "dom" },
  ],
  plugins: plugins
}
