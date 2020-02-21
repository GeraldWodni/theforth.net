#!/bin/bash

# clone packages from github on startup
if [ ! -f package ]; then
    echo "cloning packages from github"
    git clone git@github.com:GeraldWodni/theforth.net-packages.git package
fi
