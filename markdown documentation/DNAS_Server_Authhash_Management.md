::: header
# Shoutcast DNAS Server Authhash Management {#shoutcast-dnas-server-authhash-management align="center"}

(Last Updated 08 Sep 2018)
:::

+-----------------------------------------------------------------------+
| ::: {#toctitle}                                                       |
| **Contents** [\[[hide](javascript:toggleToc()){#togglelink            |
| .internal}\]]{.toctoggle}                                             |
| :::                                                                   |
|                                                                       |
| - [1 Introduction](#Introduction)                                     |
|   - [1.1 When is an Authhash needed?](#When_is_an_Authhash_needed.3F) |
|   - [1.2 Why is an Authhash needed?](#Why_is_an_Authhash_needed.3F)   |
| - [2 Management](#Management)                                         |
|   - [2.1 Creating](#Creating)                                         |
|   - [2.2 Updating](#Updating)                                         |
|   - [2.3 Duplicating](#Duplicating)                                   |
|   - [2.4 Manual Editing](#Manual_Editing)                             |
| - [3 Management Issues](#Management_Issues)                           |
+-----------------------------------------------------------------------+

[]{#Introduction}

## 1. Introduction

------------------------------------------------------------------------

One of the key aspects of the v2 Shoutcast Directory infrastructure (as
used by the v2 DNAS server) is an authhash which is used to validate
your DNAS server when it tries to connect to the Shoutcast Directory for
any of the station(s) you run.\
\
Once an authhash has been obtained, it will be valid for all DNAS
servers of the station being broadcast which make use of it though it
will be tied to the original host used to generate it if subsequent
editing is required.

\

    An authhash is not something you are charged for and are free to create.

    You should never publically post an authhash - treat it like its a password!

\
You can obtain multiple authhash or re-use an existing authhash
depending on your needs and the type and format of the stream. So the
same authhash can be used for all instances of a station if each stream
is using a different bitrate or type as the Shoutcast Directory will
automatically list those streams separately for you.

\

[]{#When_is_an_Authhash_needed.3F}

## 1.1. When is an Authhash needed? [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

The DNAS server can be run in three modes:

- **Public** - If you want your station to appear in the Shoutcast
  Directory
- **Private** - If you do not want your station to be listed e.g. an
  internal company station
- **CDN** - This mode allows for either running in Public or Private
  mode but requires an authhash

If you want the station to be publically listed then you will need an
authhash, otherwise it is not needed for private stations.

If you want to run the DNAS privately then you can change the
appropriate setting in the stream source being used. Otherwise you can
change publicserver or streampublicserver (if using stream specific
control) to be \'never\' in the DNAS\'s configuration file e.g.
**publicserver=never**.

\

[]{#Why_is_an_Authhash_needed.3F}

## 1.2. Why is an Authhash needed? [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

The main purpose of an authhash is to help to ensure your listing in the
Shoutcast Directory will use the same stationid irrespective of server
address changes and other changes which could not be guaranteed when
using a v1 based DNAS server. This is achieved the authhash acting as a
fixed piece of information the Shoutcast Directory knows about and from
the DNAS server being able to provide it so there is no doubt when we
find your listing details (which was not possible with the previous v1
based methods).

It also makes it simple to ensure that multiple servers for a stream are
correctly grouped together and that they all provide the same stream
title and associated metadata. This is because the authhash can be
re-used on other streams so by copy + pasting it into another stream
configuration, it is simple to add other servers to a listing. With a v1
DNAS server, you would have to ensure that all sources connected were
setup the same otherwise it is possible for them not to be grouped
correctly or in some cases be grouped with the servers of an unrelated
stream.

The authhash is also used as part of the DNAS+ and DNAS+ for CDN
streaming solutions where it will provide the additional information
needed to allow the DNAS to provide the additional monetisation and
advert solutions.

Finally, it makes it possible to control and also change details of the
stream without having to rely upon access to all sources used to feed
the stream (which can be useful if you have multiple DJs providing the
stream and they are not as careful about their settings for the stream
title as they should be).

\
Overall, the authhash helps ensure a better stability in your listing as
well as resolving some issues with the v1 Shoutcast system. It may seem
like an unnecessary step and take up a bit more time to get up and
running but is the equivalent of signing up and filling in details for
your stream(s) as other stream directories require.

\

[]{#Management}

## 2. Management [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: thumb
[![DNAS Summary
Page](res/Summary.png){.thumb}](res/Summary.png "DNAS Summary Page")
:::

To obtain a authhash, you first need to have setup the v2 DNAS server
and have a source (such as the Source DSP) connected so the stream is
recognised by the DNAS.

Then you need to login to the \'**Server Summary**\' page which is
accessed from the \'**Server Login**\' link in the top right on
publically accessible pages of the DNAS server.

::: thumb
[![DNAS Server Summary
Page](res/Start.png){.thumb}](res/Start.png "DNAS Server Summary Page")
:::

    To login, the username is 'admin' and the password is the
    configured adminpassword (see DNAS server - section 4.8)

You can also access it directly by opening
<http://127.0.0.1:8000/admin.cgi> if doing this on the same machine as
the DNAS server is being run on. If you have changed \'**portbase**\'
then you will need to change **8000** to the value specified for
\'portbase\'. If you are accessing this remotely then you will need to
change **127.0.0.1** to the appropriate IP address / DNS name of the
machine you are trying to access.

On the \'**Server Summary**\' page you will see listed any streams which
have sources connected or have been configured. For streams which have
sources connected, \'[Create Authhash](#Creating)\' and \'[Update
Authhash](#Updating)\' options will be shown as appropriately beneath
the stream number. Additionally there will be a \'[Manually Edit
Authhash](#Manual_Editing)\' option.

\

[]{#Creating}

## 2.1. Creating [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: thumb
[![Creating an
Authhash](res/Editing.png){.thumb}](res/Editing.png "Creating an Authhash")
:::

\

    Depending on the version and configuration of your DNAS server
    it may automatically do this step for you the first time the stream
    is started. If it does then see 'Update Authhash' for making edits.

To create an authhash for a stream, click the \'**Create Authhash**\'
link. This will take you to where you need to fill in the missing fields
as applicable for your stream as the DNAS server will attempt to fill in
fields with the information obtained from the source. Once all of the
required information has been entered then click the \'**Create
Authhash**\' button.

\
If there is a missing field or something is determined to not be
correct, you will either see a **red** or **orange** border around the
field which needs to be entered or changed or you will be provided with
additional help. This will generally happen if you enter a value for the
station name which is not allowed (as per
[here](http://wiki.shoutcast.com/wiki/SHOUTcast_Radio_Authhash_API#Illegal_Input_Values)).

::: thumb
[![Created an
Authhash](res/Completed.png){.thumb}](res/Completed.png "Created an Authhash")
:::

\
On successful creation, the new authhash will be saved into the
configuration file either in the root configuration file or one where
there\'s an empty streamauthhash entry which matches the stream
identifier. When you go back to the \'**Server Summary**\' page the
\'[Create Authhash](#Creating)\' link will have changed to \'[Update
Authhash](#Updating)\'.

\

[]{#Updating}

## 2.2. Updating [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

Updating an authhash is the same as with creating an authhash with the
existing details of the authhash shown in the fields instead of being
taken from the connected source. If there are no issues and the authhash
can be updated from the machine used (with it having the same external
IP as was used when creating the authhash) then any changes made should
be updated.

If there is a missing field or something is determined to not be
correct, you will either see a **red** or **orange** border around the
field which needs to be entered or changed or you will be provided with
additional help. This will generally happen if you enter a value for the
station name which is not allowed (as per
[here](http://wiki.shoutcast.com/wiki/SHOUTcast_Radio_Authhash_API#Illegal_Input_Values)).

    It normally takes a few seconds for the changed details to be fully
    recognised. If you have made a mistake or are trying to get listed
    then you may need to wait a minute before trying to update again.

\
The DNAS server will attempt to apply any updated authhash changes
automatically (even if made from the main DNAS server used to edit the
details and other streams are using the same authhash) though if the
DNAS server cannot complete this then it may automatically drop the
current source for the stream(s) to allow it to then re-connect so it
can then update the stream to sue the new details.

\

[]{#Duplicating}

## 2.3. Duplicating [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

If you want to use the same authhash on another stream (e.g. if only the
stream format is different or you want to group the same stream content)
then you can use the \'[Manually Edit Authhash](#Manual_Editing)\'
option or to manually edit the configuration file by setting the
relevant \'**streamauthhash**\' entry for the required stream
configuration group followed by using the \'**Reload All Stream
Configuration(s)**\' option on the \'**Server Summary**\' page.

\

[]{#Manual_Editing}

## 2.4. Manual Editing [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: thumb
[![Manually Editing an
Authhash](res/Manual.png){.thumb}](res/Manual.png "Manually Editing an Authhash")
:::

This is provided to make it easier to duplicate existing authhashes
between streams on the same DNAS server or to copy them onto a different
DNAS server instance. It provides the means to see the authhash for the
selected stream or to choose an existing authhash from another stream on
the DNAS server, allowing it to be choosen or cleared or replaced.

\

[]{#Management_Issues}

## 3. Management Issues [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

If you experience issues with managing your authhash, make sure you
follow any information provided to attempt to resolve the issue e.g.
checking the DNAS server log for any specific messages it notes.

If that still does not work then you will need to contact support via
[support@shoutcast.com](http://goo.gl/2YzesR), ensuring you provide any
appropriate information about the DNAS server and browser being used and
any specific errors reported such as those in the DNAS server log.

\
