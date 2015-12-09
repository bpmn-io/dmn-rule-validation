'use strict';

var TestHelper = require('../../../TestHelper');

var domClasses = require('min-dom/lib/classes');

/* global bootstrapModeler, inject */


describe('features/verifier', function() {

  beforeEach(bootstrapModeler());
  
  beforeEach(inject(function(modeling) {
	modeling.createRow({id: 'rule1'});
    modeling.createRow({id: 'rule2'});
    // modeling.editCell('rule1', 'input1', '>= 100');
    modeling.editCell('rule1', 'input1', '"gold"');
    // modeling.editCell('rule2', 'input1', '< 100');
    modeling.editCell('rule2', 'input1', '"silver"');
	// modeling._elementRegistry.get("col1").businessObject.inputExpression.typeRef = 'integer'
  }));
  
  
  it('there should be no rows of class "wrongValue"', inject(function(verifier, modeling, elementRegistry) {
	  
	var elements = elementRegistry._elements
	console.log(modeling._elementRegistry._elements["rule1"].gfx.innerHTML);
	verifier.verifyTable();
	
    expect(domClasses(elements["cell_input1_rule1"].gfx).contains("wrongValue")).to.be.false;
    expect(domClasses(elements["cell_input1_rule2"].gfx).contains("wrongValue")).to.be.false;
  }));

  it('should add class "wrongValue" to cell when cell value is in wrong type (string)', inject(function(verifier, modeling, elementRegistry) {
	  
	modeling.editCell('rule1', 'input1', 'gold');
	var elements = elementRegistry._elements
	
	verifier.verifyTable();
	
    expect(domClasses(elements["cell_input1_rule1"].gfx).contains("wrongValue")).to.be.true;
    expect(domClasses(elements["cell_input1_rule2"].gfx).contains("wrongValue")).to.be.false;
  }));
  
  it('should add class "wrongValue" to cell when cell value is in wrong type (integer)', inject(function(verifier, modeling, elementRegistry) {
	  
	elementRegistry.get("input1").businessObject.inputExpression.typeRef = 'integer';
	modeling.editCell('rule1', 'input1', '>= 100');
	modeling.editCell('rule2', 'input1', '101.12');
	var elements = elementRegistry._elements
	
	verifier.verifyTable();
	
    expect(domClasses(elements["cell_input1_rule1"].gfx).contains("wrongValue")).to.be.false;
    expect(domClasses(elements["cell_input1_rule2"].gfx).contains("wrongValue")).to.be.true;
  }));
  
  it('should add a overlapping rule into "Missing and overlapping rules" table (string)', inject(function(elementRegistry, graphicsFactory, verifier, sheet, modeling) {
	
	modeling.createRow({id: 'rule3'});
	modeling.editCell('rule3', 'input1', '"silver"');
	
	verifier.verifyTable();
	
	var errorTableFirstRow = sheet.getContainer().childNodes[3].tBodies[0].rows[0];
	var errorValue = errorTableFirstRow.cells[0].getElementsByTagName("span")[0].innerHTML;

	expect(errorValue === 'Rule ("silver") has overlap in rules: 2,3').to.be.true;

  }));
  
  it('should add a overlapping rule into "Missing and overlapping rules" table (numeric)', inject(function(verifier, sheet, modeling, elementRegistry) {
	
	elementRegistry.get("input1").businessObject.inputExpression.typeRef = 'integer';
	modeling.editCell('rule1', 'input1', '< 100');
	modeling.editCell('rule2', 'input1', '>= 100');
	
	modeling.createRow({id: 'rule3'});
	modeling.editCell('rule3', 'input1', '[10,100)');
	
	verifier.verifyTable();
	
	var errorTableFirstRow = sheet.getContainer().childNodes[3].tBodies[0].rows[0];
	var errorValue = errorTableFirstRow.cells[0].getElementsByTagName("span")[0].innerHTML;
	
	expect(errorValue === 'Rule ([10, 100)) has overlap in rules: 1,3').to.be.true;

  }));
  
  it('should highlight overlapping rules when clicked "Higlight overlapping rules', inject(function(verifier, sheet, modeling, elementRegistry) {
	modeling.createRow({id: 'rule3'});
	modeling.editCell('rule3', 'input1', '"silver"');
	
	console.log("-------");
	console.log(Object.keys(elementRegistry.get("cell_utilityColumn_rule1")));
	console.log(modeling._elementRegistry._elements["rule1"].gfx.innerHTML);
	console.log("-------");
	
	verifier.verifyTable();
	
	var elements = elementRegistry._elements
	
	var errorTableFirstRow = sheet.getContainer().childNodes[3].tBodies[0].rows[0];
	errorTableFirstRow.cells[1].getElementsByTagName("input")[0].click();
	
	console.log(modeling._elementRegistry._elements["rule1"].gfx.innerHTML);
	
	expect(domClasses(elements["rule1"].gfx).contains("overlapping-rules-focused")).to.be.false;
	expect(domClasses(elements["rule2"].gfx).contains("overlapping-rules-focused")).to.be.true;
	expect(domClasses(elements["rule3"].gfx).contains("overlapping-rules-focused")).to.be.true;
	
  }));
  
  it('should add a missing rule into "Missing and overlapping rules" table', inject(function(verifier, sheet, modeling, elementRegistry) {
	
	elementRegistry.get("input1").businessObject.inputExpression.typeRef = 'integer';
	modeling.editCell('rule1', 'input1', '< 100');
	modeling.editCell('rule2', 'input1', '> 100');
	
	
	verifier.verifyTable();
	
	var errorTableFirstRow = sheet.getContainer().childNodes[3].tBodies[0].rows[0];
	var errorValue = errorTableFirstRow.cells[0].getElementsByTagName("span")[0].innerHTML;
	
	expect(errorValue === 'No rule exists for (100)').to.be.true;
	
  }));
  
  it('should add missing rule when clicked "Add missing rule" button', inject(function(verifier, sheet, modeling, elementRegistry) {
	
	elementRegistry.get("input1").businessObject.inputExpression.typeRef = 'integer';
	modeling.editCell('rule1', 'input1', '< 100');
	modeling.editCell('rule2', 'input1', '> 100');
	
	
	verifier.verifyTable();
	
	var errorTableFirstRow = sheet.getContainer().childNodes[3].tBodies[0].rows[0];
	errorTableFirstRow.cells[1].getElementsByTagName("input")[0].click();
	
	var lastRule = sheet._lastRow.body.businessObject.inputEntry[0];
	
	expect(lastRule.text === '100').to.be.true;
	
  }));

});
