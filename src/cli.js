#!/usr/bin/env node

var program = require('commander');
var config = require('../package.json');
var fs = require('fs');
var parseUrl = require('url').parse;
var path = require('path');
var git = require('nodegit');
var fetch = require('node-fetch');
var async = require('async');


var packageRepo = 'joesonw/tpm';
var packageBranch = 'master';


program
    .version(config.version)
    .command('install [name...]')
    .description('install one or more packages')
    .alias('i')
    .option('-s, --save', 'save package info to local')
    .action(function (names, opts) {
    	var fetches = [];
    	for (var name of names) {
    		fetches.push(function(cb) {
    			fetchPackageInfo(name, function(err, json) {
    				if (err) return cb(err);
    				if (!json.repository) {
						return cb("repository is not a tpm package")
					}
					var repo = json.repository;
					if (repo.type == 'git') {
						downloadGitPackage(json, function(err) {
							if (err) return cb(err);
							console.log('pakcage "' + name + '" installed successfully');
							if (opts.save) {
								savePacakgeInfo(json, cb);
							} else {
								cb(null);
							}
						});
					}
    			})
    		});
    	}
    	async.series(fetches, function(err) {
    		if (err) {
    			if (err.message) {
    				console.error(err.message);
    				console.error(err.stack);
    			} else {
    				console.error(err);
    			}
    		}
    	})
	})
program
	.command('uninstall [name...]')
	.description('uninstall one or more packages')
	.alias('u')
    .option('-s, --save', 'save package info to local')
    .action(function (names, opts) {
    	for (var name of names) {
    		rmrf('./ts_modules/' + name);
    		if (opts.save) {
    			var json = JSON.parse(fs.readFileSync('./ts-package.json').toString());
    			if (json.dependencies) {
    				delete json.dependencies[name];
    			}
    			fs.writeFileSync('./ts-package.json', JSON.stringify(json, false, 2));
    		}
    	}
    });

program.parse(process.argv);

function ensureTsModules() {
	if (fs.existsSync('./ts_modules')) return;
	fs.mkdirSync('./ts_modules');
}

function ensureTsPackageJson() {
	if (fs.existsSync('./ts-package.json')) return;
	var output = {
		dependencies: {

		}
	};
	fs.writeFileSync('./ts-package.json',JSON.stringify(output,false,2));
}

function savePacakgeInfo(json, cb) {
	ensureTsPackageJson();
	fs.readFile('./ts-package.json',function(err, content) {
		if (err) return cb(err);
		content = JSON.parse(content.toString());
		content.dependencies[json.name] = json.version;
		fs.writeFile('./ts-package.json', JSON.stringify(content, false, 2), cb);
	})
}

function downloadGitPackage(json, cb) {
	var repo = json.repository;
	var gitUrl = repo.git;
	rmrf('./ts_modules/' + json.name);
	git.Clone
		.clone(gitUrl,'./ts_modules/' + json.name)
		.then(function(repo) {
			cb(null);
		})
		.catch(function(err) {
			cb(err);
		});

} 




function fetchPackageInfo(name, cb) {
	var url = 'https://raw.githubusercontent.com/' + packageRepo + '/' + packageBranch + '/packages/';
	fetch(url + name + '.json')
		.then(function(res) {
			if (!res.ok) throw ('package "' + name + '" not found.' );

			return res.json();
		})
		.then(function (json) {
			cb(null, json);
		})
		.catch(function(err) {
			cb(err);
		})
}

function rmrf(dirPath) {
  	if (fs.existsSync(dirPath)) {
    	var files = fs.readdirSync(dirPath)
    	if (files && files.length > 0) {
      		for (var i = 0; i < files.length; i++) {
        		var filePath = dirPath + '/' + files[i]
        		if (fs.statSync(filePath).isFile()) {
          			fs.unlinkSync(filePath)
        		} else {
          			rmrf(filePath)
          		}
      		}
    	}
    	fs.rmdirSync(dirPath)
  	}
}