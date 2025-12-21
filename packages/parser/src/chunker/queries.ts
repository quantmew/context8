/**
 * Tree-sitter query patterns for symbol extraction
 */

export const TYPESCRIPT_QUERIES = {
  // Function declarations and arrow functions
  functions: `
    (function_declaration
      name: (identifier) @name
    ) @function

    (lexical_declaration
      (variable_declarator
        name: (identifier) @name
        value: (arrow_function)
      )
    ) @function
  `,

  // Class declarations
  classes: `
    (class_declaration
      name: (type_identifier) @name
    ) @class
  `,

  // Method definitions within classes
  methods: `
    (method_definition
      name: (property_identifier) @name
    ) @method
  `,

  // Interface declarations
  interfaces: `
    (interface_declaration
      name: (type_identifier) @name
    ) @interface
  `,

  // Type alias declarations
  typeAliases: `
    (type_alias_declaration
      name: (type_identifier) @name
    ) @type_alias
  `,

  // Import statements
  imports: `
    (import_statement
      source: (string) @source
    ) @import
  `,

  // Export statements
  exports: `
    (export_statement) @export
  `,
};

export const PYTHON_QUERIES = {
  // Function definitions
  functions: `
    (function_definition
      name: (identifier) @name
    ) @function

    (decorated_definition
      definition: (function_definition
        name: (identifier) @name
      )
    ) @decorated_function
  `,

  // Class definitions
  classes: `
    (class_definition
      name: (identifier) @name
    ) @class

    (decorated_definition
      definition: (class_definition
        name: (identifier) @name
      )
    ) @decorated_class
  `,

  // Import statements
  imports: `
    (import_statement
      name: (dotted_name) @module
    ) @import

    (import_from_statement
      module_name: (dotted_name) @module
    ) @from_import
  `,
};
