-- Chrome Profile Router
--
-- Registered as the macOS default web browser. Every http/https link opened
-- from another app arrives here first, so no Chrome profile sees the link
-- (history, cookies, recently closed) until the user has picked one.
--
-- Launched directly (double-click), it shows setup status and saved rules.

use AppleScript version "2.7"
use framework "Foundation"
use framework "AppKit"
use scripting additions

property chromeApp : "Google Chrome"
property appTitle : "Chrome Profile Router"
-- How many path segments deep the "Always for …" options go.
property maxPathLevels : 3

on run
	showHome()
end run

on open location theURL
	routeURL(theURL)
end open location

-- Routing -------------------------------------------------------------------

on routeURL(theURL)
	set profiles to chromeProfiles()
	if profiles is missing value then
		activateSelf()
		display alert "Couldn't read your Chrome profiles" message "Chrome's profile list (Local State) was not found. Is Google Chrome installed and has it been run at least once?" & return & return & theURL buttons {"Cancel", "Open in Chrome"} default button "Open in Chrome" cancel button "Cancel" as warning
		runShell("open -a " & quoted form of chromeApp & " " & quoted form of theURL)
		return
	end if

	set savedDir to matchingRule(theURL)
	if savedDir is not missing value and profileName(profiles, savedDir) is not missing value then
		openInProfile(theURL, savedDir)
		return
	end if

	showPicker(theURL, profiles)
end routeURL

on openInProfile(theURL, profileDir)
	runShell("open -na " & quoted form of chromeApp & " --args " & quoted form of ("--profile-directory=" & profileDir) & " " & quoted form of theURL)
end openInProfile

on runShell(command)
	try
		do shell script command
	on error errMsg
		activateSelf()
		display alert "Couldn't open Chrome" message errMsg as critical
	end try
end runShell

-- Picker --------------------------------------------------------------------

on showPicker(theURL, profiles)
	set alert to current application's NSAlert's alloc()'s init()
	alert's setMessageText:"Open in which Chrome profile?"
	alert's setInformativeText:(shortenURL(theURL))

	set i to 0
	repeat with p in profiles
		set i to i + 1
		set b to (alert's addButtonWithTitle:(|name| of p))
		if i ≤ 9 then
			(b's setKeyEquivalent:(i as text))
		else
			(b's setKeyEquivalent:"")
		end if
	end repeat
	set cancelButton to alert's addButtonWithTitle:"Cancel"
	cancelButton's setKeyEquivalent:(character id 27)

	-- "Remember" options: this once, the host, then each path prefix.
	set optionTitles to {"Just this once"}
	set optionRules to {missing value}
	set parts to urlParts(theURL)
	if parts is not missing value then
		set end of optionTitles to "Always for " & (host of parts)
		set end of optionRules to {"domains", host of parts}
		set prefix to host of parts
		set segs to segments of parts
		set levels to count segs
		if levels > maxPathLevels then set levels to maxPathLevels
		repeat with n from 1 to levels
			set prefix to prefix & "/" & item n of segs
			set end of optionTitles to "Always for " & prefix & "/…"
			set end of optionRules to {"paths", prefix}
		end repeat
	end if

	set popup to current application's NSPopUpButton's alloc()'s initWithFrame:{{0, 0}, {280, 26}} pullsDown:false
	popup's addItemsWithTitles:optionTitles
	popup's sizeToFit()
	alert's setAccessoryView:popup

	activateSelf()
	set response to (alert's runModal()) as integer
	set choice to response - 999 -- NSAlertFirstButtonReturn is 1000
	if choice < 1 or choice > (count profiles) then return

	set chosenDir to dir of item choice of profiles
	set selected to ((popup's indexOfSelectedItem()) as integer) + 1
	if selected > 1 then
		set {ruleKind, ruleKey} to item selected of optionRules
		saveRule(ruleKind, ruleKey, chosenDir)
	end if
	openInProfile(theURL, chosenDir)
end showPicker

on shortenURL(theURL)
	if (length of theURL) ≤ 240 then return theURL
	return (text 1 thru 170 of theURL) & "…" & (text -60 thru -1 of theURL)
end shortenURL

on activateSelf()
	current application's NSApp's activateIgnoringOtherApps:true
end activateSelf

-- Chrome profiles -----------------------------------------------------------

-- Returns a list of {|name|, dir} records sorted by name, or missing value.
on chromeProfiles()
	set statePath to (POSIX path of (path to application support from user domain)) & "Google/Chrome/Local State"
	set stateData to current application's NSData's dataWithContentsOfFile:statePath
	if stateData is missing value then return missing value
	set state to current application's NSJSONSerialization's JSONObjectWithData:stateData options:0 |error|:(missing value)
	if state is missing value then return missing value
	set cache to state's valueForKeyPath:"profile.info_cache"
	if cache is missing value then return missing value
	if (cache's |count|()) as integer is 0 then return missing value

	set entries to current application's NSMutableArray's array()
	repeat with dirName in ((cache's allKeys()) as list)
		set dirName to contents of dirName
		set profName to ((cache's objectForKey:dirName)'s objectForKey:"name")
		if profName is missing value then set profName to dirName
		(entries's addObject:{|name|:profName, dir:dirName})
	end repeat
	set sorter to current application's NSSortDescriptor's sortDescriptorWithKey:"name" ascending:true selector:"localizedCaseInsensitiveCompare:"
	entries's sortUsingDescriptors:{sorter}
	return entries as list
end chromeProfiles

on profileName(profiles, profileDir)
	repeat with p in profiles
		if dir of p is profileDir then return |name| of p
	end repeat
	return missing value
end profileName

-- URLs ----------------------------------------------------------------------

-- Returns {host, segments, fullPath} or missing value if the URL has no host.
-- fullPath is "host/seg1/seg2", matching the keys stored under "paths".
on urlParts(theURL)
	set u to current application's NSURL's URLWithString:theURL
	if u is missing value then return missing value
	set h to u's |host|()
	if h is missing value then return missing value
	set h to (h's lowercaseString()) as text
	if h is "" then return missing value

	set segs to {}
	repeat with s in ((u's pathComponents()) as list)
		set s to contents of s
		if s is not "/" and s is not "" then set end of segs to s
	end repeat

	set fullPath to h
	repeat with s in segs
		set fullPath to fullPath & "/" & s
	end repeat
	return {host:h, segments:segs, fullPath:fullPath}
end urlParts

-- Rules ---------------------------------------------------------------------
--
-- Stored as JSON: {"domains": {"host": "Profile Dir"},
--                  "paths":   {"host/path/prefix": "Profile Dir"}}
-- A path rule matches the URL exactly or any URL below it; the longest match
-- wins, and path rules take priority over domain rules.

on rulesDir()
	return (POSIX path of (path to application support from user domain)) & appTitle
end rulesDir

on rulesPath()
	return rulesDir() & "/rules.json"
end rulesPath

on loadRules()
	set rules to missing value
	set fileData to current application's NSData's dataWithContentsOfFile:(rulesPath())
	if fileData is not missing value then
		-- 1 = NSJSONReadingMutableContainers
		set parsed to current application's NSJSONSerialization's JSONObjectWithData:fileData options:1 |error|:(missing value)
		if parsed is not missing value then
			if (parsed's isKindOfClass:(current application's NSMutableDictionary)) as boolean then set rules to parsed
		end if
	end if
	if rules is missing value then set rules to current application's NSMutableDictionary's dictionary()
	repeat with ruleKind in {"domains", "paths"}
		set ruleKind to contents of ruleKind
		if (rules's objectForKey:ruleKind) is missing value then (rules's setObject:(current application's NSMutableDictionary's dictionary()) forKey:ruleKind)
	end repeat
	return rules
end loadRules

on writeRules(rules)
	current application's NSFileManager's defaultManager()'s createDirectoryAtPath:(rulesDir()) withIntermediateDirectories:true attributes:(missing value) |error|:(missing value)
	-- 11 = PrettyPrinted | SortedKeys | WithoutEscapingSlashes
	set json to current application's NSJSONSerialization's dataWithJSONObject:rules options:11 |error|:(missing value)
	json's writeToFile:(rulesPath()) atomically:true
end writeRules

on saveRule(ruleKind, ruleKey, profileDir)
	set rules to loadRules()
	((rules's objectForKey:ruleKind)'s setObject:profileDir forKey:ruleKey)
	writeRules(rules)
end saveRule

on matchingRule(theURL)
	set parts to urlParts(theURL)
	if parts is missing value then return missing value
	set rules to loadRules()
	set fullPath to fullPath of parts

	set pathRules to rules's objectForKey:"paths"
	set best to missing value
	set bestLength to 0
	considering case
		repeat with prefix in ((pathRules's allKeys()) as list)
			set prefix to contents of prefix
			if (fullPath is prefix or fullPath starts with (prefix & "/")) and (length of prefix) > bestLength then
				set best to (pathRules's objectForKey:prefix) as text
				set bestLength to length of prefix
			end if
		end repeat
	end considering
	if best is not missing value then return best

	set domainRule to (rules's objectForKey:"domains")'s objectForKey:(host of parts)
	if domainRule is missing value then return missing value
	return domainRule as text
end matchingRule

-- Home screen (app opened directly) -----------------------------------------

on showHome()
	activateSelf()
	repeat
		if isDefaultBrowser() then
			set status to "✅ Profile Router is your default browser. Links from other apps will ask which Chrome profile to use."
			set choices to {"Manage Rules…", "Done"}
		else
			set status to "⚠️ Profile Router is not your default browser yet, so links still open straight in Chrome." & return & return & "Click “Set Default Browser…”, then choose “Profile Router” under “Default web browser”."
			set choices to {"Set Default Browser…", "Manage Rules…", "Done"}
		end if
		set answer to button returned of (display dialog status buttons choices default button "Done" with title appTitle)
		if answer is "Done" then return
		if answer is "Manage Rules…" then manageRules()
		if answer is "Set Default Browser…" then
			do shell script "open 'x-apple.systempreferences:com.apple.Desktop-Settings.extension'"
			return
		end if
	end repeat
end showHome

on isDefaultBrowser()
	set probe to current application's NSURL's URLWithString:"https://example.com"
	set handlerApp to current application's NSWorkspace's sharedWorkspace()'s URLForApplicationToOpenURL:probe
	if handlerApp is missing value then return false
	set handlerID to (current application's NSBundle's bundleWithURL:handlerApp)'s bundleIdentifier()
	return (handlerID's isEqualToString:(current application's NSBundle's mainBundle()'s bundleIdentifier())) as boolean
end isDefaultBrowser

on manageRules()
	repeat
		set profiles to chromeProfiles()
		if profiles is missing value then set profiles to {}
		set rules to loadRules()
		set labels to {}
		set refs to {}
		repeat with ruleKind in {"domains", "paths"}
			set ruleKind to contents of ruleKind
			set bucket to (rules's objectForKey:ruleKind)
			set sortedKeys to ((bucket's allKeys())'s sortedArrayUsingSelector:"localizedCaseInsensitiveCompare:") as list
			repeat with ruleKey in sortedKeys
				set ruleKey to contents of ruleKey
				set profileDir to (bucket's objectForKey:ruleKey) as text
				set profName to profileName(profiles, profileDir)
				if profName is missing value then set profName to profileDir & " (missing profile)"
				if ruleKind is "domains" then
					set end of labels to ruleKey & "  →  " & profName
				else
					set end of labels to ruleKey & "/…  →  " & profName
				end if
				set end of refs to {ruleKind, ruleKey}
			end repeat
		end repeat

		if (count labels) is 0 then
			set answer to button returned of (display dialog "No saved rules yet." & return & return & "Pick “Always for …” in the profile picker to route a site straight to a profile." buttons {"Show Rules File", "OK"} default button "OK" with title appTitle)
			if answer is "Show Rules File" then revealRulesFile()
			return
		end if

		set picked to choose from list labels with title appTitle with prompt "Saved rules. Select rules to remove:" OK button name "Remove" cancel button name "Done" with multiple selections allowed
		if picked is false then return
		repeat with rowLabel in picked
			set rowLabel to contents of rowLabel
			repeat with n from 1 to count labels
				if item n of labels is rowLabel then
					set {ruleKind, ruleKey} to item n of refs
					((rules's objectForKey:ruleKind)'s removeObjectForKey:ruleKey)
				end if
			end repeat
		end repeat
		writeRules(rules)
	end repeat
end manageRules

on revealRulesFile()
	set rules to loadRules()
	writeRules(rules)
	do shell script "open -R " & quoted form of rulesPath()
end revealRulesFile
