// @author Madranges Frédéric
// @source I use the npm DSS module created by darcyclarke darcy@darcyclarke.me
// @git github.com/darcyclarke/dss
// I have the following options, possibility to create variables custom detection
// I also improve the code to make it more modular
// One can also give a particular processing according to the variables provided to modify the code souce, but it is possible
// The rendering does this in JSON format, in a file where you can personalize the PATH

'use strict'

var path = require('path')
var gutil = require('gulp-util')
var through = require('through2')
var fs = require('fs')
var dss = require('dss')

// DSS Object
var dss = (function(){
  
  // Module reference
  var _dss = function(){};

  // Variable of origin, init of variables
  _dss.tabVariable = [ 'name', 'description', 'state', 'markup'];

  // Return an Array with the variable tabVariable
  _dss.getTabVariable = function(){
      return _dss.tabVariable;
  }

  // Allows you to add custom variables. If the function has an argument (array), we compile the two array
  _dss.add = function(tabs){
    // Check that it is an array
    if(Array.isArray(tabs)){
      _dss.tabVariable = _dss.tabVariable.concat(tabs);
    }
  }

  // Default detect function
  _dss.detect = function(){
    return true;
  };

  /*
   * Modify detector method
   *
   * @param (Function) The callback to be used to detect variables
   */
  _dss.detector = function(callback){
    _dss.detect = callback;
  };

  // Store parsers
  _dss.parsers = {};

  /*
   * Add a parser for a specific variable
   *
   * @param (String) The name of the variable
   * @param (Function) The callback to be executed at parse time
   */
  _dss.parser = function(name, callback){
    _dss.parsers[name] = callback;
  };

  /*
   * Trim whitespace from string
   *
   * @param (String) The string to be trimmed
   * @return (String) The trimmed string
   */
  _dss.trim = function(str, arr){
    var defaults = [ /^\s\s*/, /\s\s*$/ ];
    arr = (_dss.isArray(arr)) ? arr.concat(defaults) : defaults;
    arr.forEach(function(regEx){
      str = str.replace(regEx, '');
    });
    return str;
  };

  /*
   * Check if object is an array
   *
   * @param (Object) The object to check
   * @return (Boolean) The result of the test
   */
  _dss.isArray = function(obj){
    return toString.call(obj) == '[object Array]';
  };

  /*
   * Check the size of an object
   *
   * @param (Object) The object to check
   * @return (Boolean) The result of the test
   */
  _dss.size = function(obj){
    var size = 0;
    for(var key in obj){
      if(Object.prototype.hasOwnProperty.call(obj, key))
        size++;
    }
    return size;
  };

  /*
   * Iterate over an object
   *
   * @param (Object) The object to iterate over
   * @param (Function) Callback function to use when iterating
   * @param (Object) Optional context to pass to iterator
   */
  _dss.each = function(obj, iterator, context){
    if(obj == null) return;
    if(obj.length === +obj.length){
      for(var i = 0, l = obj.length; i < l; i++){
        if(iterator.call(context, obj[i], i, obj) === {}) return;
      }
    } else {
      for(var key in obj){
        if(_.has(obj, key)){
          if(iterator.call(context, obj[key], key, obj) === {}) return;
        }
      }
    }
  };

  /*
   * Extend an object
   *
   * @param (Object) The object to extend
   */
  _dss.extend = function(obj){
    _dss.each(Array.prototype.slice.call(arguments, 1), function(source){
      if(source){
        for(var prop in source){
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  /*
   * Squeeze unnecessary extra characters/string
   *
   * @param (String) The string to be squeeze
   * @param (String) The string to be matched
   * @return (String) The modified string
   */
  _dss.squeeze = function(str, def){
    return str.replace(/\s{2,}/g, def);
  };

  /*
   * Normalizes the comment block to ignore any consistent preceding
   * whitespace. Consistent means the same amount of whitespace on every line
   * of the comment block. Also strips any whitespace at the start and end of
   * the whole block.
   *
   * @param (String) Text block
   * @return (String) A cleaned up text block
   */
  _dss.normalize = function(text_block){
    
    // Strip out any preceding [whitespace]* that occur on every line. Not
    // the smartest, but I wonder if I care.
    text_block = text_block.replace(/^(\s*\*+)/, '');

    // Strip consistent indenting by measuring first line's whitespace
    var indent_size = false;
    var unindented = (function(lines){
      return lines.map(function(line){
        var preceding_whitespace = line.match(/^\s*/)[0].length;
        if(!indent_size)
          indent_size = preceding_whitespace;
        if(line == ''){
          return '';
        } else if(indent_size <= preceding_whitespace && indent_size > 0){
          return line.slice(indent_size, (line.length - 1));
        } else {
          return line;
        }
      }).join("\n");
    })(text_block.split("\n"));

    return _dss.trim(text_block);

  };

  /*
   * Takes a file and extracts comments from it.
   *
   * @param (Object) options
   * @param (Function) callback
   */
  _dss.parse = function(lines, options, callback){

    // Options
    options = (options) ? options : {};
    options.preserve_whitespace = !!(options.preserve_whitespace);

    // Setup
    var _this = this,
        current_block = '',
        inside_single_line_block = false,
        inside_multi_line_block = false,
        last_line = '',
        start = "{start}",
        end = "{/end}",
        _parsed = false,
        _blocks = [],
        parsed = '',
        blocks = [],
        temp = {},
        lineNum = 0;

    /*
     * Parses line
     *
     * @param (Num) the line number
     * @param (Num) number of lines
     * @param (String) line to parse/check
     * @return (Boolean) result of parsing
     */
    var parser = function(temp, line, block, file){
      var indexer = function(str, find){
            return (str.indexOf(find) > 0) ? str.indexOf(find) : false;
          },
          parts = line.replace(/.*@/, ''),
          i = indexer(parts, ' ') || indexer(parts, '\n') || indexer(parts, '\r') || parts.length,
          name = _dss.trim(parts.substr(0, i)),
          description = _dss.trim(parts.substr(i)),
          variable = _dss.parsers[name],
          index = block.indexOf(line);
      line = {};
      line[name] = (variable) ? variable.apply(null, [index, description, block, file]) : '';

      if(temp[name]){
        if(!_dss.isArray(temp[name]))
          temp[name] = [ temp[name] ];
        temp[name].push(line[name]);
      } else {
        temp = _dss.extend(temp, line);
      }
      return temp;
    };

    /*
     * Comment block
     */
    var block = function(){
      this._raw = (comment_text) ? comment_text : '';
      this._filename = filename;
    };

    /*
     * Check for single-line comment
     *
     * @param (String) line to parse/check
     * @return (Boolean) result of check
     */
    var single_line_comment = function(line){
      return !!line.match(/^\s*\/\//);
    };

    /*
     * Checks for start of a multi-line comment
     *
     * @param (String) line to parse/check
     * @return (Boolean) result of check
     */
    var start_multi_line_comment = function(line){
      return !!line.match(/^\s*\/\*/);
    };

    /*
     * Check for end of a multi-line comment
     *
     * @parse (String) line to parse/check
     * @return (Boolean) result of check
     */
    var end_multi_line_comment = function(line){
      if(single_line_comment(line))
        return false;
      return !!line.match(/.*\*\//);
    };

    /*
     * Removes comment identifiers for single-line comments.
     *
     * @param (String) line to parse/check
     * @return (Boolean) result of check
     */
    var parse_single_line = function(line){
      return line.replace(/\s*\/\//, '');
    };

    /*
     * Remove comment identifiers for multi-line comments.
     *
     * @param (String) line to parse/check
     * @return (Boolean) result of check
     */
    var parse_multi_line = function(line){
      var cleaned = line.replace(/\s*\/\*/, '');
      return cleaned.replace(/\*\//, '');
    };

    lines = lines + '';
    lines.split(/\n/).forEach(function(line){

      lineNum = lineNum + 1;
      line = line + '';

      // Parse Single line comment
      if(single_line_comment(line)){
        parsed = parse_single_line(line);
        if(inside_single_line_block){
          current_block += '\n' + parsed;
        } else {
          current_block = parsed;
          inside_single_line_block = true;
        }
      }

      // Parse multi-line comments
      if(start_multi_line_comment(line) || inside_multi_line_block){
        parsed = parse_multi_line(line);
        if(inside_multi_line_block){
          current_block += '\n' + parsed;
        } else {
          current_block += parsed;
          inside_multi_line_block = true;
        }
      }

      // End a multi-line block
      if(end_multi_line_comment(line)){
        inside_multi_line_block = false;
      }

      // Store current block if done
      if(!single_line_comment(line) && !inside_multi_line_block){
        if(current_block){
          _blocks.push(_dss.normalize(current_block));
        }
        inside_single_line_block = false;
        current_block = '';
        last_line = '';
      }

    });

    // Done first pass
    _parsed = true;

    // Create new blocks with custom parsing
    _blocks.forEach(function(block){

      // Remove extra whitespace
      block = block.split('\n').filter(function(line){
        return (_dss.trim(_dss.normalize(line)));
      }).join('\n');

      // Split block into lines
      block.split('\n').forEach(function(line){
        if(_dss.detect(line))
          temp = parser(temp, _dss.normalize(line), block, lines);
      });
      
      // Push to blocks if object isn't empty
      if(_dss.size(temp))
        blocks.push(temp);
      temp = {};

    }); 
            
    // Execute callback with filename and blocks
    callback({ blocks: blocks });

  };

  //Takes in fact the variable "_dss.tabVariable" on which we make a "forEach" if it is State we return the name, escaped, description, 
  //otherwise if it is markup we decompose the markup, otherwise we return the contents of variables...
  //If we must add a special behavior for a variable customize it is here that it must be created in the switch
  _dss.renderParse = function(globaleVar){
    // start forEach, name is a content of the array
    globaleVar.forEach(function (name) {
    
    switch(name) {
        case 'state':
              //Traitement special pour state
              dss.parser(name,  function fn(i, line, block, file){
                  var states = line.split(' - ');
                      return {
                        name: (states[0]) ? dss.trim(states[0]) : '',
                        escaped: (states[0]) ? dss.trim(states[0].replace('.', ' ').replace(':', ' pseudo-class-')) : '',
                        description: (states[1]) ? dss.trim(states[1]) : ''
                      };
                });
            break;
        case 'markup':
                // straitement speciale pour markup
                dss.parser(name, function(i, line, block, file){

                  // find the next instance of a parser (if there is one based on the @ symbol)
                  // in order to isolate the current multi-line parser
                  var nextParserIndex = block.indexOf('* @', i+1),
                      markupLength = nextParserIndex > -1 ? nextParserIndex - i : block.length,
                      markup = block.split('').splice(i, markupLength).join('');

                  markup = (function(markup){
                    var ret = [],
                        lines = markup.split('\n');

                    lines.forEach(function(line){
                      var pattern = '*',
                          index = line.indexOf(pattern);

                      if (index > 0 && index < 10)
                        line = line.split('').splice((index + pattern.length), line.length).join('');

                      // multiline
                      if (lines.length <= 2)
                        line = dss.trim(line);

                      if (line && line != '@markup')
                        ret.push(line);

                    });
                    return ret.join('\n');
                  })(markup);

                  return {
                    example: markup,
                    escaped: markup.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  };
                });
            break;
        default:
        // By default I return the contents of the variable
            dss.parser(name,  function(i, line, block, file){ return line;});
    } //switch
  });
}

  // Return function
  return _dss;

})(); // close module

// Describe detection pattern
// By default, the detector is based on @ to find the variables in the css, if you want to change this behavior just change the regex
dss.detector(function(line){
  if(typeof line !== 'string')
    return false;
  var reference = line.split("\n\n").pop();
  return !!reference.match(/.*@/);
});

// Module exports
if(typeof exports !== 'undefined'){
  if(typeof module !== 'undefined' && module.exports){
    exports = module.exports = dss;
  }
  exports.dss = dss;
} else {
  root['dss'] = dss;
}

// AMD definition
if (typeof define === 'function' && define.amd){
  define(function(require){
    return dss;
  });
}
module.exports = function (options) {
    // Option gulp add custom variable
    var tab = options.tab || []
    // Option gulp destination of the final Json file
    var dist = options.dist || './dist/'
    // Will contain a key object: file name sass value: variable @ + its value
    var styleguide = {}    
    
    // I pass in argument "tab" to the function "dss.add"
     // to add custom variables
    dss.add(tab);

    // I give as argument the contents of dss.getTabVariable () which returns the variables to find, save in DSS
    // renderParse () affects the behavior for each variable
    dss.renderParse(dss.getTabVariable());

    function process(file, encoding, callback) {
        // file contains the SASS file patch
        // encoding contains the buffer
        // callback
        
        if (file.isNull()) {
            callback(null, file)
            return
        }

        if (file.isStream()) {
            callback(new gutil.PluginError('gulp-dss', 'Streaming not supported'))
            return
        }
        
        //file.contents.toString () contains the contents of all sass files
        dss.parse(file.contents.toString(), {}, function (parsed) {
           // parsed: contains an array key / value or key and variable @ .. and value its value
           // path.basename (file.path) contains the name plus the expention of the file sass ex: "import-all.scss"
           // .split ( '.') [0]: we cut from the point it remains: "import-all"
           // styleguide and an object that contains key css file name "import-all" value: "@ variables and their value"
           styleguide[path.basename(file.path).split('.')[0]] = parsed;
           // allows to redo the operation for each file sass find
           callback(null, file);
        })   

    }

    function end(callback) {
// we write a Json file in the direction of the "dist", we transform the styleguide object into JSON, and we still in UTF8        fs.writeFile(dist, JSON.stringify(styleguide, null, 4), 'utf8');
        callback()
    }

    return through.obj(process, end)
}
