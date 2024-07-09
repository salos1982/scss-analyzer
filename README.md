# Scss Code Analyzer

Scss Code Analyzer is a tool for cleaning code from scss waste. After some time of development code contains references to styles that are not already exists or scss files contains classes that are not used anymore. It creates difficulties for new developers in reading code and increase package size for new users.

## Limitations

This tool does not five any guaranties it just helps to find waste in your code.
It is helpful if you meet folowing code condtions
* Use .tsx files for code
* Use .scss files for styles
* Import styles in the form
  ```
  import <style_object> from "<path_to_style_file>"
  ```
* Use styles in the form
  ```
  <a className={<style_object>.<class_name>} href="link">Any text</a>
  ```

## Installation
```
npm install --save-dev scss-code-analyzer
```

## Usage
```
npx scss-code-analyzer <project_dir>
```

`project_dir` is optional parameter. If it is not set the current directory will be used to search tsx and scss files