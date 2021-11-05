#!/bin/bash

COLOR_YELLOW='\033[1;33m'
NO_COLOR='\033[0m' # No Color

FILES=./test/*.js
for f in $FILES
do
  printf "\n${COLOR_YELLOW}[ TESTPACK ${f} ]${NO_COLOR}\n\n"
  truffle test $f
done
