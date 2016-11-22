# JSON-DSS
- **[Official NPM Package JSON-DSS](https://npmjs.org/package/json-dss)**
- It a extend to the **[NPM Package DSS](https://npmjs.org/package/dss)** created by darcyclarke

**JSON-DSS**, Documented Style Sheets convert to JSON , is a comment styleguide and parser for CSS, LESS, STYLUS, SASS and SCSS code.

## Generating Documentation

In most cases, you will want to include the **JSON-DSS** parser in a build step that will generate documentation files automatically. 
## Install JSON-DSS

    npm install json-dss


## Gulp Task

    gulp.task('json', function () {
    return gulp.src('./src/sass/**')
        .pipe(dss({
            dist: './src/docs/json/data.json',
            tab: ['author', 'test', 'toto']
        }));
    });

Here we are two arguments :

 - Dist : content a destination path to the final file json
 - Tab : content a array with custom variables, allows to declare the variables to be searched in the code css or scss

#### Exemple custom varibles in tab

css

  /*
    *@author Description of author
  *@test Description of teste
  *@toto Description of toto
  */

scss

    //@author  Description of author
    //@teste  Description of author
    //@toto  Description of author

## Parser 

#### Example Comment Block

css

    /**
      * @name Button
      * @description Your standard form button.
      * 
      * @state :hover - Highlights when hovering.
      * @state :disabled - Dims the button when disabled.
      * @state .primary - Indicates button is the primary action.
      * @state .smaller - A smaller button
      * 
      * @markup
      *   <button>This is a button</button>
      */ 

#### or

scss

    //
    // @name Button
    // @description Your standard form button.
    // 
    // @state :hover - Highlights when hovering.
    // @state :disabled - Dims the button when disabled.
    // @state .primary - Indicates button is the primary action.
    // @state .smaller - A smaller button
    // 
    // @markup
    //   <button>This is a button</button>
    // 


#### Example Parser Implementation



    javscript
    var lines = fs.readFileSync('styles.css'),
        options = {},
        callback = function(parsed){
          console.log(parsed);
        };
    dss.parse(lines, options, callback);



#### Example Generated Object

javascript

    {
      "name": "Button",
      "description": "Your standard form button.",
      "state": [
        { 
          "name": ":hover",
          "escaped": "pseudo-class-hover",
          "description": "Highlights when hovering."
        },
        {
          "name": ":disabled",
          "escaped": "pseudo-class-disabled",
          "description": "Dims the button when disabled."
        },
        {
          "name": ".primary",
          "escaped": "primary",
          "description": "Indicates button is the primary action."
        },
        {
          "name": ".smaller",
          "escaped": "smaller",
          "description": "A smaller button"
        }
      ],
      "markup": {
        "example": "<button>This is a button</button>",
        "escaped": "&lt;button&gt;This is a button&lt;/button&gt;"
      }
    }



## Modifying Parsers

**JSON-DSS**, by default, includes 4 parsers for the **name**, **description**, **states** and **markup** (@name, @description, @state, @markup) of a comment block. You can add to or override these default parsers using the following:

javascript

    // Matches @link
    dss.parser('link', function(i, line, block){
    
      // Replace link with HTML wrapped version
      var exp = /(b(https?|ftp|file)://[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/ig;
      line.replace(exp, "<a href='$1'>$1</a>");
      return line;
       
    });

## Module Function

###Different functions have been added:

**dss.add() :** To add custom variables, it works like this: it concatenates the array of initial variable with the array of new variables to make one. 

    _dss.add = function(tabs){
        // Check that it is an array
        if(Array.isArray(tabs)){
          _dss.tabVariable = _dss.tabVariable.concat(tabs);
        }
      }

**dss.getTabVarible() :** Allows to return the table of initial variables or with the custom

    // Variable of origin, init of variables
      _dss.tabVariable = [ 'name', 'description', 'state', 'markup'];
    
      // Return an Array with the variable tabVariable
      _dss.getTabVariable = function(){
          return _dss.tabVariable;
      }

**dss.detector() :** Allows to change the detector of variable in the css or scss initially it is the @

    dss.detector(function(line){
      if(typeof line !== 'string')
        return false;
      var reference = line.split("\n\n").pop();
      return !!reference.match(/.*@/);
    });

**dss.renderParse() :** Allows to configure the behavior of our variables by default we return the content line of the variables, but as for "state" or "markup", it is here that it will be necessary to add a specific behavior, Need it

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
## Update :
I am in the process of completing a complete project to create a documentation, it will soon be on git and I will give you the link once finish early January 2017
## DSS Sublime Text Plugin

You can now **auto-complete** DSS-style comment blocks using @sc8696's [Auto-Comments Sublime Text Plugin](https://github.com/sc8696/sublime-css-auto-comments)


