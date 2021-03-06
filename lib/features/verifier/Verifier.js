'use strict';

var domClasses = require('min-dom/lib/classes');
var $ = require('jquery');
var ids = new(require('diagram-js/lib/util/IdGenerator'))('row');

function Verifier(elementRegistry, modeling, sheet) {
	this._elementRegistry = elementRegistry;
	this._modeling = modeling;
	this._sheet = sheet;
}

Verifier.prototype.verifyTable = function () {
	
	var errorTable = $(this._sheet.getContainer()).get(0).getElementsByClassName("errorTable")[0];
	if(typeof errorTable !== undefined){
		$(errorTable).remove();
	}
	
	
	var elems = document.querySelectorAll(".missingValue");
	
	[].forEach.call(elems, function(el) {
		el.className = el.className.replace(/\bmissingValue\b/, "");
	});
	
	var elems = document.querySelectorAll(".wrongValue");

	[].forEach.call(elems, function(el) {
		el.className = el.className.replace(/\bwrongValue\b/, "");
	});
	
	var elems = document.querySelectorAll(".overlapping-rules-focused");

	[].forEach.call(elems, function(el) {
		el.className = el.className.replace(/\boverlapping-rules-focused\b/, "");
	});
	
	var elReg = this._elementRegistry._elements;
	var hasError = false;
	var cellValues = {};
	var ruleOrder = [];
	for(var propertyName in elReg){
		if(propertyName.match(/cell/gi) && propertyName.match(/input/gi) && 
		(propertyName.match(/rule/gi) || propertyName.match(/row-/gi) || propertyName.match(/table-/gi))){
			var cell = elReg[propertyName].element;	
			var busObject = cell.column.businessObject;
			var valueType = "";
			var allowedValues = [];
			var isInputValue = false;
			if('inputExpression' in busObject){
				var expession = busObject.inputExpression;
			} else {
				var expession = busObject;
			}
			valueType = expession.typeRef;
			var cellValue = "";
			if('content' in cell && (typeof cell.content !== "undefined")){
				cellValue = cell.content.text;
				var cellTrimmedValue = cellValue;
				if("string" !== valueType){
					cellTrimmedValue = cellValue.replace(/[(\[\)\]\<>=\s+]/g, "");
				}
				if(cellTrimmedValue !== ""){
					if((!isString(cellTrimmedValue) && "string" === valueType) ||
					((["integer","long","double","number"].indexOf(valueType) > -1) && (!(isNumeric(cellTrimmedValue)) || 
					("integer" === valueType && !(isInteger(cellTrimmedValue))))) || 
					("boolean" === valueType && !(isBoolean(cellTrimmedValue)))){
						addTooltip(cell.id, valueType, cellTrimmedValue);
						hasError = true;
					}
				}
			}
			if('inputExpression' in busObject){
				if(valueType === "boolean"){
					if(cellValue === "1"){ cellValue = "true"}
					else if(cellValue === "0"){ cellValue = "false"}
					allowedValues = ["true", "false"];
				} else if(["integer","long","double","number"].indexOf(valueType) > -1){
					allowedValues = ["any"];
				}
				cellValues[cell.id] = new cellAttributes(cell.id, valueType, allowedValues, cellValue, cell.column.id, cell.row.id);
			}
		} if(!(propertyName.match(/cell/gi)) && propertyName.match(/input/gi) && 
		!(propertyName.match(/rule/gi) || propertyName.match(/row-/gi) || propertyName.match(/table-/gi)) 
		&& ruleOrder.length === 0){
			var clause = elReg[propertyName].element;
			var nextClause = clause;
			var previousClause = $.extend(true, {}, clause);
			while(true){
				if(typeof nextClause.businessObject.inputExpression !== "undefined"){
					ruleOrder.push(nextClause.id);
				}
				if(typeof nextClause.next.isAnnotationsColumn === "undefined"){
					nextClause = nextClause.next;
				} else { break; }
			}
			while(true){
				if(previousClause.previous.id !== "utilityColumn"){
					previousClause = previousClause.previous;
					if(typeof previousClause.businessObject.inputExpression !== "undefined"){
						ruleOrder.unshift(previousClause.id);
					}
				} else { break; }
			}
		}
	}
	if(!hasError){
		var inputAndRules = getRulesAndInputs(cellValues, ruleOrder, this._elementRegistry);
		var inputs = inputAndRules[0];
		var rule = inputAndRules[1];

		var rulesClone = $.extend(true, {}, rule);
		var inputColumnCount = Object.keys(inputs).length;
		var ruleArray = Array.apply(null, Array(inputColumnCount)).map(String.prototype.valueOf, "any")
		
		var errorTable = "<table class='errorTable' id='errorTable' style='margin-top:20px; width:100%;'>" + 
		"<thead><tr><th style='text-align:left;' colspan='2'> Missing and overlapping rules</th></tr></thead>" +
		"<tbody class='errorTableBody'></tbody></table>";
		$(this._sheet.getContainer()).append(errorTable);
		
		var overlappingRules = findOverlappingRules(rulesClone, ruleArray, 0, inputColumnCount, []);
		outputOverlappingRules(overlappingRules, false, this._elementRegistry, this._modeling, this._sheet);	
		
		var missingRules = findMissingRules(rulesClone, ruleArray, 0, inputColumnCount, []);
		outputOverlappingRules(missingRules, true, this._elementRegistry, this._modeling, this._sheet);
			
	}
};

function invertRules(rules, index){
	var invertedRules = {};
	var firstRuleId = Object.keys(rules)[0];
	var rulesClone = (JSON.parse(JSON.stringify(rules)));
	if(rules[firstRuleId][index].type !== "string" && rules[firstRuleId][index].type !== "boolean"){
		for(var ruleId in rules){
			var rule = (JSON.parse(JSON.stringify(rules[ruleId][index])));
			if(rule.intervalValues[0] !== null){
				var newRuleId = ruleId + "-" + "<" + rule.intervalValues[0];
				rule.equalSigns = [false, !rule.equalSigns[0]];
				rule.intervalValues = [-Infinity, rule.intervalValues[0]];
				rulesClone[ruleId][index] = rule;
				invertedRules[newRuleId] = rulesClone[ruleId];
			}
			var rulesClone = (JSON.parse(JSON.stringify(rules)));
			var rule = (JSON.parse(JSON.stringify(rules[ruleId][index])));
			if(rule.intervalValues[1] !== null){
				var newRuleId = ruleId + "-" + ">" + rule.intervalValues[1];
				rule.equalSigns = [!rule.equalSigns[1], false];
				rule.intervalValues = [rule.intervalValues[1], Infinity];
				rulesClone[ruleId][index] = rule;
				invertedRules[newRuleId] = rulesClone[ruleId];
			}
			if(rule.intervalValues[0] === null && rule.intervalValues[1] === null){
				rule.equalSigns = [false, false];
				rule.intervalValues = [-Infinity, -923545346346];
				rulesClone[ruleId][index] = rule;
				invertedRules[ruleId] = rulesClone[ruleId];
			}
		}
	} else{
		for(var ruleId in rules){
			var rule = (JSON.parse(JSON.stringify(rulesClone[ruleId][index])));
			var ruleStringValues = rule.multipleStringValues;
			var ruleAllowedValues = rule.allowedValues;
			var missingValues = [];
			for(var i = 0; i < ruleAllowedValues.length; i++){
				if(ruleStringValues.length === 1 && ruleStringValues[0] === ""){
					break;
				} else if(ruleAllowedValues[i] !== "" && ruleStringValues.indexOf(ruleAllowedValues[i]) === -1){
					missingValues.push(ruleAllowedValues[i]);
				}
			}
			rule.multipleStringValues = missingValues;
			rulesClone[ruleId][index] = rule;
			invertedRules[ruleId] = rulesClone[ruleId];
		}
	}
	return invertedRules;
}


function findOverlappingRules(comparingRules, currentRule, index, inputColumnCount, overalappingRulesList){
	if(inputColumnCount === index){
		if(Object.keys(comparingRules).length > 1){
			comparingRules.ruleValue = currentRule;
			overalappingRulesList.push(comparingRules);
		}
	} else{
		var ruleType = comparingRules[Object.keys(comparingRules)[0]][index].type;
		var overalappingRules = {};
		var lastIntervalValue = NaN;
		var lastIntervalEqualSign = false;
		var lastIntervalIsStartInterval = false;
		var sortedRuleOrder = sortRules(comparingRules, index);
		for(var i = 0; i < sortedRuleOrder.length; i++){
			var ruleId = Object.keys(sortedRuleOrder[i])[0];
			var rule = sortedRuleOrder[i][ruleId];
			var ruleValue = rule.value;
			var newIntervalValue = true;
			if(Object.keys(overalappingRules).length === 0 || 
			(!lastIntervalIsStartInterval && rule.start && lastIntervalEqualSign !== rule.equal && lastIntervalValue === ruleValue) ||
			(lastIntervalValue === ruleValue && lastIntervalIsStartInterval === rule.start && 
			(lastIntervalEqualSign === rule.equal || ruleValue === -Infinity || ruleValue === Infinity) && 
			(lastIntervalEqualSign === rule.equal || ruleValue === -Infinity || ruleValue === Infinity))){
				newIntervalValue = false;							
			}
			if(newIntervalValue){
				var missingRule = constructOverlappingRange(lastIntervalValue, lastIntervalEqualSign, rule, ruleType, lastIntervalIsStartInterval);
				currentRule[index] = missingRule;
				var newRules = {};
				var ruleIds = Object.keys(overalappingRules);
				for(var rId in ruleIds){
					newRules[ruleIds[rId]] = comparingRules[ruleIds[rId]].slice(0);
				}
				findOverlappingRules(newRules, currentRule.slice(0), index + 1, inputColumnCount, overalappingRulesList);
			}
			if(rule.start){
				overalappingRules[ruleId] = rule;
			} else{
				delete overalappingRules[ruleId];
			}
			lastIntervalIsStartInterval = rule.start;
			lastIntervalValue = ruleValue;
			lastIntervalEqualSign = rule.equal;
		}
	}
	return overalappingRulesList;
}


function findMissingRules(comparingRules, currentRule, index, inputColumnCount, missingRuleList){
	if(inputColumnCount > index){
		var ruleType = comparingRules[Object.keys(comparingRules)[0]][index].type;
		var overalappingRules = {};
		var lastIntervalValue = NaN;
		var lastIntervalEqualSign = false;
		var lastIntervalIsStartInterval = false;
		var sortedRuleOrder = sortRules(comparingRules, index);
		for(var i = 0; i < sortedRuleOrder.length; i++){
			var ruleId = Object.keys(sortedRuleOrder[i])[0];
			var rule = sortedRuleOrder[i][ruleId];
			var ruleValue = rule.value;
			var newIntervalValue = true;
			
			if(Object.keys(overalappingRules).length === 0 || 
			(!lastIntervalIsStartInterval && rule.start && lastIntervalEqualSign !== rule.equal && lastIntervalValue === ruleValue) ||
			(lastIntervalValue === ruleValue && lastIntervalIsStartInterval === rule.start && 
			(lastIntervalEqualSign === rule.equal || ruleValue === -Infinity || ruleValue === Infinity) && 
			(lastIntervalEqualSign === rule.equal || ruleValue === -Infinity || ruleValue === Infinity))){
				newIntervalValue = false;							
			}
			
			if(Object.keys(overalappingRules).length === 0 || 
			(!lastIntervalIsStartInterval && rule.start && lastIntervalEqualSign && !rule.equal && lastIntervalValue === ruleValue) ||
			(!lastIntervalIsStartInterval && rule.start && !lastIntervalEqualSign && rule.equal && lastIntervalValue === ruleValue) ||
			(lastIntervalValue === ruleValue && lastIntervalIsStartInterval === rule.start && 
			(lastIntervalEqualSign || ruleValue === -Infinity || ruleValue === Infinity) && 
			(rule.equal || ruleValue === -Infinity || ruleValue === Infinity))){
				newIntervalValue = false;							
			}
			if(newIntervalValue){
				var missingRule = constructOverlappingRange(lastIntervalValue, lastIntervalEqualSign, rule, ruleType, lastIntervalIsStartInterval);
				currentRule[index] = missingRule;
				var newRules = {};
				var ruleIds = Object.keys(overalappingRules);
				for(var rId in ruleIds){
					newRules[ruleIds[rId]] = comparingRules[ruleIds[rId]].slice(0);
				}
				findMissingRules(newRules, currentRule.slice(0), index + 1, inputColumnCount, missingRuleList);
			}
			if(rule.start){
				overalappingRules[ruleId] = rule;
			} else{
				delete overalappingRules[ruleId];
			}
			lastIntervalIsStartInterval = rule.start;
			lastIntervalValue = ruleValue;
			lastIntervalEqualSign = rule.equal;
		}
		var overalappingRules = {};
		var lastIntervalValue = NaN;
		var lastIntervalEqualSign = false;
		var lastIntervalIsStartInterval = false;
		var rulesClone = $.extend(true, {}, comparingRules);
		var inverted = invertRules(rulesClone, index);
		var sortedRuleOrder = sortRules(inverted, index);
		var ruleIds = [];
		for(var id in inverted){
			if(ruleIds.length === 0){
				ruleIds.push(inverted[id][0].ruleId);
			} else if(ruleIds.indexOf(inverted[id][0].ruleId) === -1){
				ruleIds.push(inverted[id][0].ruleId);
			}
		}
		var uniqueRuleIDs = ruleIds.length;
		for(var i = 0; i < sortedRuleOrder.length; i++){
			var ruleId = Object.keys(sortedRuleOrder[i])[0];
			var rule = sortedRuleOrder[i][ruleId];
			var ruleValue = rule.value;
			var newIntervalValue = true;
			
			if(Object.keys(overalappingRules).length === 0 || ruleValue === "any" || (!rule.start &&  ruleValue === -923545346346) ||
			(lastIntervalValue === ruleValue && lastIntervalIsStartInterval === rule.start && 
			(lastIntervalEqualSign === rule.equal || ruleValue === -Infinity || ruleValue === Infinity) && 
			(rule.equal === lastIntervalEqualSign || ruleValue === -Infinity || ruleValue === Infinity))){
				newIntervalValue = false;							
			}
			if(newIntervalValue){
				var missingRule = constructOverlappingRange(lastIntervalValue, lastIntervalEqualSign, rule, ruleType, lastIntervalIsStartInterval);
				currentRule[index] = missingRule;
				var newRules = {};
				var ruleIds = Object.keys(overalappingRules);
				for(var rId in ruleIds){
					newRules[ruleIds[rId]] = inverted[ruleIds[rId]].slice(0);
				}
				if(Object.keys(newRules).length === uniqueRuleIDs){
					newRules.ruleValue = currentRule;
					missingRuleList.push(JSON.parse(JSON.stringify(newRules)));
				}
			}
			if(rule.start){
				overalappingRules[ruleId] = rule;
			} else{
				delete overalappingRules[ruleId];
			}
			lastIntervalIsStartInterval = rule.start;
			lastIntervalValue = ruleValue;
			lastIntervalEqualSign = rule.equal;
		}
		
	}
	return missingRuleList;
}


function sortRules(comparingRules, index){
	var allRanges = [];
	var firstRuleId = Object.keys(comparingRules)[0];
	if(comparingRules[firstRuleId][index].type !== "string" && comparingRules[firstRuleId][index].type !== "boolean"){
		for(var r in comparingRules){
			var rule = comparingRules[r][index];
			if(allRanges.length === 0){
				var compactRule= {};
				compactRule[r] = new cellAttributesForSort(rule, false, false);
				allRanges.push(compactRule);
				compactRule = {};
				compactRule[r] = new cellAttributesForSort(rule, true, false);
				allRanges.push(compactRule);
			} else{
				var currentPosition = 0;
				for(var position = 0; position < 2; position++){
					var pushedToArray = false;
					for(var i = currentPosition; i < allRanges.length; i++){
						var currentRuleValue = rule.intervalValues[position];
						var comparableRule = Object.keys(allRanges[i])[0];
						var wholeRule = allRanges[i][comparableRule];
						var value = wholeRule.value
						if(currentRuleValue <= value){
							if(currentRuleValue === value){
								if((!rule.equalSigns[1] && position) || 
								(rule.equalSigns[0] && !position && !(!wholeRule.start && !wholeRule.equal)) || 
								(rule.equalSigns[1] && position && !(!wholeRule.start && !wholeRule.equal) && !(wholeRule.start && wholeRule.equal))){
									pushedToArray = true;
								} 
							} else {
								pushedToArray = true;
							}
							if(pushedToArray){
								var compactRule= {};
								compactRule[r] = new cellAttributesForSort(rule, position, false);
								allRanges.splice(i, 0, compactRule);
								currentPosition = i;
								break;
							}
						}
					}
					if(!pushedToArray){
						var compactRule= {};
						compactRule[r] = new cellAttributesForSort(rule, position, false);
						allRanges.splice(i+1, 0, compactRule);
						currentPosition = i+1;
					}
				}
				
			}
		}
	} else {
		var allRanges = [];
		var allValues = comparingRules[firstRuleId][index].allowedValues.slice(0);
		if(allValues.length === 1 && allValues[0] === ""){
			for(var r in comparingRules){
				var rule = comparingRules[r][index];
				var compactRule= {};
				compactRule[r] = new cellAttributesForSort(rule, false, true, "any");
				allRanges.push(compactRule);
				var compactRule= {};
				compactRule[r] = new cellAttributesForSort(rule, true, true, "any");
				allRanges.push(compactRule);
			}
				
		} else{
			for(var i = 0; i < allValues.length; i++){
				var value = allValues[i];
				if(value !== ""){
					var ruleEnds = [];
					for(var r in comparingRules){
						var rule = comparingRules[r][index];
						if(rule.multipleStringValues.indexOf(value) > -1 || rule.multipleStringValues.indexOf("") > -1){
							var compactRule= {};
							compactRule[r] = new cellAttributesForSort(rule, false, true, value);
							allRanges.push(compactRule);
							var compactRule= {};
							compactRule[r] = new cellAttributesForSort(rule, true, true, value);
							ruleEnds.push(compactRule);
						}
					}
					allRanges = allRanges.concat(ruleEnds);
				}
			}
		}
	}
	return allRanges;
}


function cellAttributesForSort(rule, isEndInterval, isString, stringValue){
	if(!isEndInterval){
		this.start = true;
		if(isString){
			this.equal = true;
			this.value = stringValue;
		} else{	
			this.equal = rule.equalSigns[0];
			this.value = rule.intervalValues[0];
		}
	} else{
		this.start = false;
		if(isString){
			this.equal = true;
			this.value = stringValue;
		} else{	
			this.equal = rule.equalSigns[1];
			this.value = rule.intervalValues[1];
		}
	}
}



function constructOverlappingRange(lastValue, equalSign, rule, ruleType, lastIntervalIsStartInterval){
	var ruleValue = rule.value;
	var ruleEqualSign = rule.equal;
	var missingRule = "";
	if(ruleType === "string" || ruleType === "boolean"){
		missingRule = lastValue;
	} else{
		if(lastValue === -Infinity){
			if(ruleValue === Infinity){
				missingRule = "any";
			} else if(rule.start && ruleEqualSign){
				if(ruleEqualSign){
					missingRule = "< " + ruleValue;
				} else{
					missingRule = "<= " + ruleValue;
				}
			} else{
				if(ruleEqualSign){
					missingRule = "<= " + ruleValue;
				} else{
					missingRule = "< " + ruleValue;
				}
			}
		} else if(ruleValue === Infinity){
			if(!lastIntervalIsStartInterval && equalSign){
				if(equalSign){
					missingRule = "> " + lastValue;
				} else{
					missingRule = ">= " + lastValue;
				}
			} else{
				if(equalSign){
					missingRule = ">= " + lastValue;
				} else{
					missingRule = "> " + lastValue;
				}
			}
		} else{
			if(equalSign === ruleEqualSign && ruleValue === lastValue){
				missingRule = lastValue;
			} else {
				if(equalSign){
					missingRule = "[" + lastValue +", ";
				} else{
					missingRule = "(" + lastValue +", ";
				}
				if(ruleEqualSign){
					missingRule += ruleValue +"]";
				} else{
					missingRule += ruleValue +")";
				}
			}
		}
	}
	return missingRule;
}


function outputOverlappingRules(overlappingRules, missingRuleCase, elementRegistry, modeling, sheet){
	var errorTableBody = $(sheet.getContainer()).get(0).getElementsByClassName("errorTableBody")[0];
	for(var i = 0; i < overlappingRules.length; i++) {
		var overlappingRuleValue = [];
		var overlappingRuleRowNRs = []
		for(var rule in overlappingRules[i]){
			if(rule === "ruleValue"){
				overlappingRuleValue = overlappingRules[i][rule];
			} else{
				overlappingRuleRowNRs.push(overlappingRules[i][rule][0].ruleNR);
			}
		}
		if(missingRuleCase){
			$(errorTableBody).append( "<tr><th class='ruleErrorText'>" + 
			"<span>No rule exists for (" + overlappingRuleValue + ")</span></th>" + 
			"<th><input type='button' class='missing_rules' data-missing_rules= " + "'" + JSON.stringify(overlappingRules[i]).replace(/'/g, "\\'") + "'" +
			"value='Add missing rule'></input>" +  
			"</th></tr>");
		} else {
			overlappingRuleRowNRs = overlappingRuleRowNRs.sort(sortNumber);
			$(errorTableBody).append("<tr><th class='ruleErrorText'>" +
			"<span>Rule (" + overlappingRuleValue  + ") has overlap in rules: " + overlappingRuleRowNRs + "</span></th>" + 
			"<th><input type='button' class='overlapping_rules' data-overlapping_rules= " + "'" + JSON.stringify(overlappingRules[i]).replace(/'/g, "\\'") + "'" +
			"value='Highlight overlapping rules'></input>" + 
			"</th></tr>");
		}
	} 
	
	$('.overlapping_rules').unbind('click').click(function(){
		
		var elems = document.querySelectorAll(".overlapping-rules-focused");
		[].forEach.call(elems, function(el) {
			el.className = el.className.replace(/\boverlapping-rules-focused\b/, "");
		});
		
		if(this.value === "Highlight overlapping rules"){
			
			var buttonElements = document.getElementsByClassName("overlapping_rules");
			for (var i = 0; i < buttonElements.length; i++){
				buttonElements[i].value = "Highlight overlapping rules";
			}
			
			this.value = "Unhighlight overlapping rules";
			var elements = elementRegistry._elements
			var rules = $(this).data('overlapping_rules');
			for(var ruleId in rules){
				if(ruleId !== "ruleValue"){
					domClasses(elements[ruleId].gfx).add('overlapping-rules-focused');
				}
			}
		} else {
			this.value = "Highlight overlapping rules";
		}
    });

    $('.missing_rules').click(function () {
		var newRowId = ids.next();
		modeling.createRow({ id: newRowId });
		var rules = $(this).data('missing_rules');
		var firstRuleId = Object.keys(rules)[0];
		var ruleValues = rules["ruleValue"];
		for(var i = 0; i < rules[firstRuleId].length; i++){
			if(ruleValues[i] !== "any"){
				modeling.editCell(newRowId, rules[firstRuleId][i].clauseId, ruleValues[i].toString());
			}
		}
		var errorTable = $(sheet.getContainer()).get(0).getElementsByClassName("errorTable")[0];
		errorTable.deleteRow(this.parentNode.parentNode.rowIndex)
    });
}


function cellAttributes(id, type, allowedValue, value, clauseId, ruleId){
	this.type = type;
	this.allowedValues = allowedValue;
	this.value = value;
	this.clauseId = clauseId;
	this.ruleId = ruleId;
	this.id = id;
	if(type !== "string" && type !== "boolean"){
		if(value.indexOf("<") > -1){
			var numericValue = Number(value.replace(/[<>=\s+]/g, ""));
			this.intervalValues = [-Infinity, numericValue];
			if(value.indexOf("=") > -1){
				this.equalSigns = [false, true];
			} else {
				this.equalSigns = [false, false];
			}
		} else if(value.indexOf(">") > -1){
			var numericValue = Number(value.replace(/[<>=\s+]/g, ""));
			this.intervalValues = [numericValue, Infinity];
			if(value.indexOf("=") > -1){
				this.equalSigns = [true, false];
			} else {
				this.equalSigns = [false, false];
			}
		} else if(value.indexOf(",") > -1){
			var equalSigns = [false, false];
			var intervalValues = value.replace(/\s+/g, "").split(",");
			var intervalValuesWithoutBrackets = value.replace(/[(\[\)\]\s+]/g, "").split(",");
			this.intervalValues = [Number(intervalValuesWithoutBrackets[0]), Number(intervalValuesWithoutBrackets[1])];
			if(intervalValues[0].indexOf("[") > -1){
				equalSigns[0] = true;
			}
			if(intervalValues[1].indexOf("]") > -1){
				equalSigns[1] = true;
			}
			this.equalSigns = equalSigns;
		} else if(value === ""){
			this.intervalValues = [Number.NEGATIVE_INFINITY, Infinity];
			this.equalSigns = [false, false];
		} else {
			var numericValue = Number(value.replace(/[<>=\s+]/g, ""));
			this.intervalValues = [numericValue, numericValue];
			this.equalSigns = [true, true];
		}
	} else if(type === "string" || type === "boolean"){
		this.multipleStringValues = value.replace(/[\s+]/g, "").split(",").sort();
	}
}


function getRulesAndInputs(allCellValues, rulesRightOrder, elementRegistry){
	var rules = {};
	var inputs = {};
	var ruleSize = rulesRightOrder.length;
	for(var inputValue in allCellValues){
		var cell = allCellValues[inputValue];
		var clauseId = cell.clauseId
		var allowedValues = [];
		if(!(clauseId in inputs) && (typeof inputs.clauseId === "undefined")){
			var cellIDs = [cell];
			if(cell.type === "string"){
				allowedValues = cell.multipleStringValues.slice(0);
			}
		} else {
			var cellIDs = inputs[clauseId]
			cellIDs.push(cell);
			if(cell.type === "string"){
				var allowedValues = inputs[clauseId].allowedValues;
				for(var i in cell.multipleStringValues){
					if(allowedValues.indexOf(cell.multipleStringValues[i]) === -1){
						allowedValues.push(cell.multipleStringValues[i].slice(0));
					}
				}	
			}
		}
		inputs[cell.clauseId] = cellIDs
		if(cell.type === "string"){
			inputs[cell.clauseId].allowedValues = allowedValues;
		}
		
		var ruleId = cell.ruleId
		var rightPositionIndex = rulesRightOrder.indexOf(clauseId);
		if(!(ruleId in rules) && (typeof rules.ruleId === "undefined")){
			var cellIDs = Array.apply(null, Array(ruleSize)).map(Number.prototype.valueOf,0);
			var ruleNumber = elementRegistry.get("cell_utilityColumn_" + ruleId).content;
			var kkk = elementRegistry.get("cell_utilityColumn_" + ruleId);
			cellIDs[rightPositionIndex] = cell;
			rules[cell.ruleId] = cellIDs;
			rules[cell.ruleId].ruleNR = ruleNumber;
		} else {
			var cellIDs = rules[ruleId];
			cellIDs[rightPositionIndex] = cell;
			rules[cell.ruleId] = cellIDs
		}
	}
	for(var i in inputs){
		if(inputs[i][0].type === "string"){
			var allowedValues = inputs[i].allowedValues.sort();
			for(var j in inputs[i]){
				if(j !== allowedValues){
					inputs[i][j].allowedValues = inputs[i].allowedValues;	
				}
			}
		}
	}
	for(var r in rules){
		for(var i = 0; i < rules[r].length; i++) {
			rules[r][i].ruleNR = rules[r].ruleNR;
		}
	}
	return [inputs, rules]
}


function makeTooltipText(valueType, inputEntry){
	var outputText = "";
	if(valueType === "string"){
		outputText = "Cell value has to be string";
	} else if(["integer","long","double","number"].indexOf(valueType) > -1){
		if(valueType === "integer" && isNumeric(inputEntry)){
			outputText = "Cell value is a float number, but has to be an integer";
		} else {
			outputText = "Cell value is a string, but has to be a number";
		}
		
	} else if(valueType === "boolean"){
		outputText = "Cell value has to be one of these values: true, false, 1 or 2";
	}
	return outputText;
}


function tooltip(cellId, tooltipText){
	
	var changeTooltipPosition = function(event) {
	  var tooltipX = event.pageX - 25;
	  var tooltipY = event.pageY - 100;
	  $('div.tooltip').css({top: tooltipY, left: tooltipX});
	};
	var showTooltip = function(event) {
		if($(cellId).hasClass("wrongValue") || $(cellId).hasClass("missingValue")){
		  $('div.tooltip').remove();
		  $('<div class="tooltip">' + tooltipText + '</div>')
				.appendTo('div.tjs-container');
		}
	};

	var hideTooltip = function() {
	   $('div.tooltip').remove();
	};

	$(cellId).bind({
	   mousemove : changeTooltipPosition,
	   mouseenter : showTooltip,
	   mouseleave: hideTooltip
	});
}


function addTooltip(cellId, valueType, inputEntry){
	var tooltipText = makeTooltipText(valueType, inputEntry);
	var divWhereWrongValueIs = "td[data-element-id='" + cellId+"']"
	$(divWhereWrongValueIs).addClass("wrongValue");
	tooltip(divWhereWrongValueIs, tooltipText)
}


function isString(value){
	var values = value.replace(/[\s+]/g, "").split(",");
	for(var i = 0; i < values.length; i++){
		if(values[i].charAt(0) !== "\"" || values[i].charAt(values[i].length-1) !== "\""){
			return false;
		}
	}
	return true;
}


function isNumeric(n) {
	if(n.split(",").length === 2){
		n = n.split(",");
		return !isNaN(parseFloat(n[0])) && isFinite(n[0]) && !isNaN(parseFloat(n[1])) && isFinite(n[1]);
	} else {
		return !isNaN(parseFloat(n)) && isFinite(n);
	}
}


function isInteger(n) {
	if(n.split(",").length  === 2){
		n = n.split(",");
		return n[0] % 1 === 0 && n[1] % 1 === 0;
	} else {
		return n % 1 === 0;
	}
}


function isBoolean(n){
	if(["1","0","true","false"].indexOf(n.toLowerCase()) > -1){
		return true;
	}
	else{
		return false;
	}
}


function sortNumber(a,b) {
    return a - b;
}


Verifier.$inject = [ 'elementRegistry', 'modeling', 'sheet'];

module.exports = Verifier;