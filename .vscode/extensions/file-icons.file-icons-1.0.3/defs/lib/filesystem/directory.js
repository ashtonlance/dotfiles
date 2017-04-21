"use strict";

const {dirname, join, resolve} = require("path");
const {lstat, statify} = require("../utils/fs.js");
const IconDelegate = require("../service/icon-delegate.js");
const EntityType = require("./entity-type.js");
const Resource = require("./resource.js");


class Directory extends Resource {
	
	constructor(path, stats){
		super(resolve(path), EntityType.DIRECTORY);
		this.consumeStats(stats);
		
		this.icon = new IconDelegate(this);
	}
	

	isRoot(){
		const {path} = this;
		for(const dir of atom.project.rootDirectories)
			if(dir && path === resolve(dir.path))
				return true;
		return false;
	}
	
	
	isRepo(){
		const {path} = this;
		for(const repo of atom.project.repositories)
			if(repo && path === dirname(resolve(repo.path)))
				return true;
		return false;
	}	
	
	
	isSubmodule(){
		for(const repo of atom.project.repositories){
			if(!repo) continue;
			
			const submodules = Object.keys(repo.submodules || {});
			if(!submodules.length)
				continue;
			
			const repoPath = dirname(resolve(repo.path));
			for(const submodule of submodules){
				const modulePath = join(repoPath, submodule);
				if(modulePath === this.path)
					return true;
			}
		}
		return false;
	}
}


module.exports = Directory;
